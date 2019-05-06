const bodyParser = require('body-parser')
const express = require('express')
const logger = require('morgan')
const app = express()
const {
  fallbackHandler,
  notFoundHandler,
  genericErrorHandler,
  poweredByHandler
} = require('./handlers.js')

// For deployment to Heroku, the port needs to be set using ENV, so
// we check for the port number in process.env
app.set('port', (process.env.PORT || 9001))

app.enable('verbose errors')

app.use(logger('dev'))
app.use(bodyParser.json())
app.use(poweredByHandler)

// --- SNAKE LOGIC GOES BELOW THIS LINE ---

// Handle POST request to '/start'
app.post('/start', (request, response) => {
  // NOTE: Do something here to start the game

  // Response data
  const data = {
      color: '#CC0000',
      headType: 'bendr',
      tailType: 'round-bum'
  }

  return response.json(data)
})

// Handle POST request to '/move'
app.post('/move', (request, response) => {
    // NOTE: Do something here to generate your move
    //console.log(JSON.stringify(request.body, 2));

    var board = request.body.board;

    // Create grid containing board
    var boardArray = new Array(board.height + 2);
    for (var y = 0; y < board.height + 2; y++) {
        boardArray[y] = new Array(board.width + 2);
        for (var x = 0; x < board.width + 2; x++) {
            if (y === 0 || y === board.height + 1 || x === 0 || x === board.width + 1)
                boardArray[y][x] = 'w';
            else
                boardArray[y][x] = ' ';
        }
    }

    // Populate grid with food
    for (var food of board.food)
        boardArray[food.y + 1][food.x + 1] = 'f';

    // Populate grid with snakes
    for (var snake of board.snakes) {
        var tailType = snake.body[snake.body.length - 1].x == snake.body[snake.body.length - 2].x && snake.body[snake.body.length - 1].y == snake.body[snake.body.length - 2].y ? 'T' : 't';
        for (var i = 0; i < snake.body.length; i++) {
            boardArray[snake.body[i].y + 1][snake.body[i].x + 1] = (i === 0 ? 'h' : (i === snake.body.length - 1 ? tailType : 'b'));
        }
    }

    console.log(boardArray);

    var you = request.body.you;

    var currentDir = getCurrentDir(you);
    var targetDir;
    var hungry = false;
    if (you.health <= 20) {
        hungry = true;
        var closestFood = getClosestFood(request.body);
        targetDir = getTargetDir(you, closestFood);
    }

    var dir = findDir(currentDir, targetDir, request.body, boardArray, board, you, hungry);

    // Response data
    const data = {
        move: dir // one of: ['up','down','left','right']
    }

    return response.json(data)
})

function findDir(currentDir, targetDir, requestBody, boardArray, board, you, hungry) {
    var potentialDirs = new Object();

    if (currentDir === 'up') {
        potentialDirs['left'] = 0;
        potentialDirs['up'] = 0;
        potentialDirs['right'] = 0;
    }
    else if (currentDir === 'down') {
        potentialDirs['left'] = 0;
        potentialDirs['down'] = 0;
        potentialDirs['right'] = 0;
    }
    else if (currentDir === 'left') {
        potentialDirs['left'] = 0;
        potentialDirs['down'] = 0;
        potentialDirs['up'] = 0;
    }
    else {
        potentialDirs['right'] = 0;
        potentialDirs['up'] = 0;
        potentialDirs['down'] = 0;
    }
    var bestDir = currentDir;
    for (var potDir in potentialDirs) {
        var nextX = requestBody.you.body[0].x + 1;
        var nextY = requestBody.you.body[0].y + 1;

        if (potDir === 'up')
            nextY--;
        else if (potDir === 'down')
            nextY++;
        else if (potDir === 'left')
            nextX--;
        else
            nextX++;

        var nextCell = boardArray[nextY][nextX];

        var nextNextCell1;
        var nextNextCell2;
        var nextNextCell3;
        var nextNextCell4;

        if (nextX + 1 <= board.width) 
            nextNextCell1 = boardArray[nextY][nextX + 1];
        if (nextX - 1 >= 0) 
            nextNextCell2 = boardArray[nextY][nextX - 1];
        if (nextY + 1 <= board.height) 
            nextNextCell3 = boardArray[nextY + 1][nextX];
        if (nextY - 1 >= 0) 
            nextNextCell4 = boardArray[nextY - 1][nextX];

        if (nextNextCell1 === 'f' || nextNextCell1 === ' ' || nextNextCell1 === 't')
            potentialDirs[potDir] += 15;
        if (nextNextCell2 === 'f' || nextNextCell2 === ' ' || nextNextCell1 === 't')
            potentialDirs[potDir] += 15;
        if (nextNextCell3 === 'f' || nextNextCell3 === ' ' || nextNextCell1 === 't')
            potentialDirs[potDir] += 15;
        if (nextNextCell4 === 'f' || nextNextCell4 === ' ' || nextNextCell1 === 't')
            potentialDirs[potDir] += 15;

        if (nextNextCell1 === 'w' || nextNextCell1 === 'b')
            potentialDirs[potDir] -= 15;
        if (nextNextCell2 === 'w' || nextNextCell2 === 'b')
            potentialDirs[potDir] -= 15;
        if (nextNextCell3 === 'w' || nextNextCell3 === 'b')
            potentialDirs[potDir] -= 15;
        if (nextNextCell4 === 'w' || nextNextCell4 === 'b')
            potentialDirs[potDir] -= 15;

        if (nextCell === 'f' && hungry)
            potentialDirs[potDir] += 50;
        if (nextCell === 'f' && !hungry)
            potentialDirs[potDir] += 20;

        if (nextCell === ' ' && hungry)
            potentialDirs[potDir] += 30;
        if (nextCell === ' ' && !hungry)
            potentialDirs[potDir] += 30;

        if (nextCell === 't' && hungry)
            potentialDirs[potDir] += 25;
        if (nextCell === 't' && !hungry)
            potentialDirs[potDir] += 25;

        if (potDir === targetDir) 
            potentialDirs[potDir] += 50;

        if (nextCell === 'w')
            potentialDirs[potDir] -= 300;

        if (nextCell === 'b' || nextCell === 'T')
            potentialDirs[potDir] -= 200;

        var middleFocus = 15;
        if (you.body[0].x + 1 < board.width / 2 && potDir === 'right')
            potentialDirs[potDir] += middleFocus;
        if (you.body[0].x + 1 > board.width / 2 && potDir === 'left')
            potentialDirs[potDir] += middleFocus;
        if (you.body[0].y + 1 > board.height / 2 && potDir === 'up')
            potentialDirs[potDir] += middleFocus;
        if (you.body[0].y + 1 < board.height / 2 && potDir === 'down')
            potentialDirs[potDir] += middleFocus;

        var snakeWillKillMe = false;
        for (var hostileSnake of requestBody.board.snakes.filter(snake => snake.id !== requestBody.you.id)) {
            var head = {
                x: hostileSnake.body[0].x + 1,
                y: hostileSnake.body[0].y + 1
            };
            if (distance({ x: nextX, y: nextY }, head) === 1) {
                if (hostileSnake.body.length < requestBody.you.body.length) {
                    potentialDirs[potDir] += 60;
                    continue;
                }  
                snakeWillKillMe = true;
            }
        }
        if (snakeWillKillMe) {
            potentialDirs[potDir] -= 100;
        }
        if (bestDir === potDir)
            continue;
        if (potentialDirs[bestDir] < potentialDirs[potDir]) {
            bestDir = potDir;
        }
        if (potentialDirs[bestDir] === potentialDirs[potDir]) {
            var random = Math.floor(Math.random() * 2);
            if (random === 0)
                bestDir = potDir;
        }
    }
    
    console.log(potentialDirs);
    console.log(bestDir);
    //console.log(bestDir);
    return bestDir;
}

function getCurrentDir(snake) {
    var xDiff = snake.body[1].x - snake.body[0].x;
    var yDiff = snake.body[1].y - snake.body[0].y;

    var currentDir = 'up';

    if (yDiff === 1)
        currentDir = 'up';
    else if (yDiff === -1)
        currentDir = 'down';
    else if (xDiff === 1)
        currentDir = 'left';
    else if (xDiff === -1)
        currentDir = 'right';

    return currentDir;
}

function getTargetDir(snake, closestFood) {
    var xDiff = snake.body[0].x - closestFood.x;
    var yDiff = snake.body[0].y - closestFood.y;

    if (Math.abs(xDiff) > Math.abs(yDiff)) {
        if (xDiff > 0)
            return "left";
        else
            return "right";
    } else {
        if (yDiff > 0)
            return "up";
        else
            return "down";
    }
}

function getClosestFood(request) {
    var head = request.you.body[0];
    var closestFood;
    var closestDistance = request.board.height + request.board.width;
    for (var food of request.board.food) {
        var diff = distance(food, head);
        if (diff < closestDistance) {
            closestDistance = diff;
            closestFood = food;
        }
    }
    return closestFood;
}

function distance(p1, p2) {
    var diffX = Math.abs(p1.x - p2.x);
    var diffY = Math.abs(p1.y - p2.y);
    return diffX + diffY;
}

app.post('/end', (request, response) => {
  // NOTE: Any cleanup when a game is complete.
  return response.json({})
})

app.post('/ping', (request, response) => {
  // Used for checking if this snake is still alive.
  return response.json({});
})

// --- SNAKE LOGIC GOES ABOVE THIS LINE ---

app.use('*', fallbackHandler)
app.use(notFoundHandler)
app.use(genericErrorHandler)

app.listen(app.get('port'), () => {
  console.log('Server listening on port %s', app.get('port'))
})
