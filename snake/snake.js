/**
 * @author Jeremy Wood
 */
var snek = (function (window, document, undefined) {

    /**
     * Default Game Settings
     * @type {number}
     * @const
     */
    var TILE_SIZE = 10,
        H_TILES = 30,
        V_TILES = 30,
        INITIAL_LENGTH = 15,
        GROW_AMOUNT = 3,
        INITIAL_SPEED_FACTOR = 10, // 1 means snake moves every 100 intervals, 100 means snake moves every 1 interval
        INTERVAL_SPEED = 15; // milliseconds per game cycle

    // Set up canvas
    var canvas = document.createElement('canvas'),
        width = TILE_SIZE * H_TILES,
        height = TILE_SIZE * V_TILES;
    canvas.width = width;
    canvas.height = height;
    var context = canvas.getContext('2d');

    var start = function () {
        document.body.appendChild(canvas);
        setInterval(step, INTERVAL_SPEED);
        publish(EVENT.GAME_START);
    };

    var stop = function () {
        document.body.removeChild(canvas);
        clearInterval();
        publish(EVENT.GAME_STOP);
    };

    var keysDown = {};

    window.addEventListener("keydown", function (event) {
        keysDown[event.keyCode] = true;
    });

    window.addEventListener("keyup", function (event) {
        delete keysDown[event.keyCode];
    });

    var time = Date.now();
    var step = function () {
        var now = Date.now(),
            dt = now - (time || now);
        time = now;

        update(dt);
        render(dt);
    };

    var update = function (delta) {
        for (var key in keysDown) {
            var value = Number(key);
            switch (value) {
                case 37: // left arrow
                    if (snake.direction != "right") {
                        snake.nextDirection = "left";
                    }
                    break;
                case 38: // up arrow
                    if (snake.direction != "down") {
                        snake.nextDirection = "up";
                    }
                    break;
                case 39: // right arrow
                    if (snake.direction != "left") {
                        snake.nextDirection = "right";
                    }
                    break;
                case 40: // down arrow
                    if (snake.direction != "up") {
                        snake.nextDirection = "down";
                    }
                    break;
                case 32: // space bar
                    if (snake.dead && snake.length() == 0) {
                        snake = new Snake(board);
                    }
                default:
            }
        }

        snake.update(delta);
        if (apple.eaten) {
            try {
                apple = new Apple(board);
            } catch (e) {
                // the player has won! TODO
            }
        }
        //if (snake.dead) {
        //    if (snake.length() == 0) {
        //        snake = new Snake(board);
        //    }
        //}
    };

    var render = function (delta) {
        context.fillStyle = "#000000";
        context.fillRect(0, 0, width, height);
        board.render();
        snake.render();
        apple.render();
    };

    /**
     * Creates a game board.
     * @param hTiles the number of horizontal tiles on the board
     * @param vTiles the number of vertical tiles on the board
     * @constructor
     */
    function Board(hTiles, vTiles) {
        this.hTiles = hTiles ? hTiles : H_TILES;
        this.vTiles = vTiles ? vTiles : V_TILES;

        this.tiles = [];
        for (var i = 0; i < this.hTiles; i++) {
            this.tiles[i] = [];
            for (var j = 0; j < this.vTiles; j++) {
                this.tiles[i][j] = new Tile(i, j);
            }
        }
    }

    Object.assign(Board.prototype, {

        isOpenTile: function (x, y) {
            return !this.tiles[x][y].type;
        },

        getTileType: function (x, y) {
            return this.tiles[x][y].type;
        },

        addTile: function (tile) {
            if (this.isOpenTile(tile.x, tile.y)) {
                this.tiles[tile.x][tile.y] = tile;
            } else {
                throw new Error("Tile is not empty!");
            }
        },

        removeTile: function (tileOrX, y) {
            if (y === undefined) {
                this.tiles[tileOrX.x][tileOrX.y] = new Tile(tileOrX.x, tileOrX.y);
            } else {
                this.tiles[tileOrX][y] = new Tile(tileOrX, y);
            }
        },

        getEmptyTiles: function () {
            var filtered = [];
            for (var i = 0; i < this.hTiles; i++) {
                for (var j = 0; j < this.vTiles; j++) {
                    if (this.isOpenTile(i, j)) {
                        filtered.push(this.tiles[i][j]);
                    }
                }
            }
            return filtered;
        },

        render: function () {
            for (var i = 0; i < this.hTiles; i++) {
                for (var j = 0; j < this.vTiles; j++) {
                    var tile = this.tiles[i][j];
                    if (tile) {
                        if (tile.type == "snek") {
                            context.fillStyle = "#FFFFFF";
                            context.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                        } else if (tile.type == "appl") {
                            context.fillStyle = "#0000FF";
                            context.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                        }
                    }
                }
            }
        }

    });

    function Tile(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type ? type : 0;
    }

    Object.assign(Tile.prototype, {

        isSamePosition: function (tile) {
            return this.x == tile.x && this.y == tile.y;
        }

    });

    function Block(x, y, prev) {
        Tile.call(this, x, y, "snek");
        this.next = undefined;
        this.prev = prev;
    }

    Block.prototype = Object.create(Tile.prototype);
    Block.prototype.constructor = Block;

    Object.assign(Block.prototype, {

        render: function () {
            context.fillStyle = "#00FF00";
            context.fillRect(this.x * TILE_SIZE, this.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        },

        addNextBlock: function () {
            this.next = new Block(this.x, this.y, this);
        },

        /**
         * This will cause the trailing block to take the place of the parent block unless it is already in that position.
         * This did not work out and is currently unused.
         */
        pullNextBlock: function () {
            if (this.next && !this.next.isSamePosition(this)) {
                this.next.x = this.x;
                this.next.y = this.y;
            }
        }

    });

    function Snake(board, length, speed, x, y) {
        this.head = new Block(x ? x : Math.floor(board.hTiles / 2), y ? y : Math.floor(board.vTiles / 2));
        this.direction = "up";
        this.nextDirection = "up";
        this.speed = speed ? 100 / speed * INTERVAL_SPEED : 100 / INITIAL_SPEED_FACTOR * INTERVAL_SPEED;
        this.timeSinceMove = 0;
        this.dead = false;

        this.board = board;
        this.board.addTile(this.head);

        if (!length) {
            length = INITIAL_LENGTH;
        }
        var block = this.head;
        this.tail = block;
        this.grow(length - 1);
        //for (var i = 1; i < length; i = i + 1) { // start at 1 because head already exists
        //    block.addNextBlock();
        //    block = block.next;
        //    this.tail = block;
        //}

    }

    Object.assign(Snake.prototype, {

        render: function () {
            var block = this.head;
            while (block) {
                block.render();
                block = block.next;
            }
        },

        length: function () {
            var count = 0;
            var block = this.head;

            while (block) {
                count++;
                block = block.next;
            }

            return count;
        },

        move: function (direction) {
            var newX = this.head.x,
                newY = this.head.y;

            switch (direction) {
                case "up":
                    newY--;
                    break;
                case "down":
                    newY++;
                    break;
                case "left":
                    newX--;
                    break;
                case "right":
                    newX++;
                    break;
            }

            if (!this.dead) {
                // Handle death conditions if not already dead
                if (newX < 0 || newY < 0 || newX >= this.board.hTiles || newY >= this.board.vTiles) {
                    this.dead = true;
                } else {
                    this.eat(this.board.tiles[newX][newY]);
                }
            }

            if (!this.dead) {
                // Propagate the coordinates down the snake
                var block = this.head,
                    oldX,
                    oldY;
                while (block) {
                    oldX = block.x;
                    oldY = block.y;
                    block.x = newX;
                    block.y = newY;
                    newX = oldX;
                    newY = oldY;

                    block = block.next;
                }

                // Handle tile updates
                this.board.addTile(this.head);
                var tail = this.getTail();
                if (tail.x != oldX || tail.y != oldY) { // if the tail has moved, remove the previous tile it existed in
                    this.board.removeTile(oldX, oldY);
                }
            }
        },

        getTail: function () {
            return this.tail;
        },

        grow: function (amount) {
            var block = this.getTail();
            for (var i = 0; i < amount; i++) {
                block.addNextBlock();
                block = block.next;
                this.tail = block;
            }
        },

        shrink: function (amount) {
            if (this.length() < 1) {
                return;
            }
            for (var i = 0; i < amount && (this.dead || this.tail.prev); i++) {
                if (!this.tail.prev) { // we're removing the last block, the head
                    this.board.removeTile(this.head);
                    this.tail = undefined;
                    this.head = undefined;
                } else {
                    var oldTail = this.tail;
                    this.tail = this.tail.prev;
                    oldTail.prev = undefined;
                    this.tail.next = undefined;
                    if (oldTail.x != this.tail.x || oldTail.y != this.tail.y) {
                        this.board.removeTile(oldTail);
                    }
                }
            }
        },

        eat: function (tile) {
            switch (tile.type) {
                case "snek":
                    this.dead = true;
                    break;
                case "appl":
                    this.board.removeTile(tile);
                    tile.eaten = true;
                    this.grow(tile.growAmount);
                    break;
                default:
            }
        },

        update: function (delta) {
            this.timeSinceMove += delta;
            if (this.timeSinceMove >= this.speed || this.dead) {
                if (this.head) { // Keep moving the snake as long as it's got a "head"
                    if (!this.dead) { // ignore directions if already dead
                        this.direction = this.nextDirection;
                    }
                    this.move(this.direction);
                    this.timeSinceMove = Math.max(0, this.timeSinceMove - this.speed);
                }

                if (this.dead) {
                    // Kill the snake one block per movement
                    this.shrink(1);
                    //this.tail = this.tail ? this.tail.prev : this.tail;
                    //this.head = this.head ? this.head.next : this.head;
                }
            }
        }

    });

    function Apple(board, x, y, growAmount) {
        if (x == undefined || y == undefined) {
            var emptyTiles = board.getEmptyTiles();
            if (emptyTiles.length == 0) {
                throw new Error("There are no empty spaces left on the board");
            }
            var i = Math.floor(Math.random() * emptyTiles.length);
        }
        Tile.call(this, x ? x : emptyTiles[i].x, y ? y : emptyTiles[i].y, "appl");
        board.addTile(this);

        this.growAmount = growAmount ? growAmount : GROW_AMOUNT;
        this.eaten = false;
    }

    Apple.prototype = Object.create(Tile.prototype);
    Apple.prototype.constructor = Apple;
    Object.assign(Apple.prototype, {

        render: function () {
            context.fillStyle = "#FF0000";
            context.fillRect(this.x * TILE_SIZE, this.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }

    });

    var board = new Board(H_TILES, V_TILES);
    var snake = new Snake(board);
    var apple = new Apple(board);


    // EVENT SYSTEM
    /**
     * @const
     */
    var EVENT = {
        /**
         * Called when the game is added to the window and started.
         * @const
         */
        GAME_START: 0,
        /**
         * Called when the game is removed from the window and stopped.
         * @const
         */
        GAME_STOP: 1
    };

    var subscribers = {};

    /**
     *
     * @param event
     * @param callback
     */
    var subscribe = function (event, callback) {
        subscribers[event] = subscribers[event] || [];
        subscribers[event].push(callback);
    };

    var publish = function (event) {
        if (subscribers && subscribers[event]) {
            var subs = subscribers[event],
                args = [].slice.call(arguments, 1),
                n, max;
            for (n = 0, max = subs.length; n < max; n++) {
                subs[n].apply(this, args);
            }
        }
    };


    // Set up the module to export
    var module = {};
    module.start = start;
    module.stop = stop;
    module.Snake = Snake;
    module.Block = Block;
    module.Tile = Tile;
    module.Board = Board;
    module.Apple = Apple;
    module.subscribe = subscribe;
    /**
     * The game events that can be subscribed to.
     * @const
     */
    module.EVENT = EVENT;
    return module;
}(window, document));
