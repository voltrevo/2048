const Grid = require('./grid.js');
const onceLater = require('./onceLater.js');
const Tile = require('./tile.js');
const rand = require('./rand.js');

const GameManager = function GameManager({
  size,
  gameSeed,
  moves,
  InputManager,
  Actuator,
  StorageManager,
}) {
  this.size = size; // Size of the grid
  this.gameSeed = gameSeed;
  this.inputManager = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator = new Actuator;
  this.moves = moves;
  this.history = [];

  this.startTiles = 2;

  this.inputManager.on('move', this.move.bind(this));
  this.inputManager.on('restart', this.restart.bind(this));
  this.inputManager.on('keepPlaying', this.keepPlaying.bind(this));
  this.inputManager.on('undo', this.popHistory.bind(this));

  window.addEventListener('hashchange', this.updateFromHash.bind(this));

  // If actuate is called many times quickly, it'll ignore all but the last call
  this.actuate = onceLater(this.actuate.bind(this));

  this.setup();
};

// Restart the game
GameManager.prototype.restart = function restart() {
  this.actuator.continueGame(); // Clear the game won/lost message
  this.moves = '';
  this.history = [];
  this.setup();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function keepPlaying() {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function isGameTerminated() {
  return this.over || (this.won && !this.keepPlaying);
};

// Set up the game
GameManager.prototype.setup = function setup() {
  this.grid = new Grid(this.size);
  this.score = 0;
  this.over = false;
  this.won = false;
  this.keepPlaying = false;
  this.history = [];

  // Add the initial tiles
  this.addStartTiles();
  this.pushHistory();

  const moves = this.moves;
  this.moves = '';

  moves.split('').forEach(moveLetter => {
    this.move('urdl'.indexOf(moveLetter));
  });

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function addStartTiles() {
  for (let i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function addRandomTile() {
  if (this.grid.cellsAvailable()) {
    const gridSeed = this.grid.seedString();

    const value = rand(`${this.gameSeed}:${gridSeed}:value`) < 0.9 ? 2 : 4;

    const indexRand = rand(`${this.gameSeed}:${gridSeed}:index`);
    const tile = new Tile(this.grid.randomAvailableCell(indexRand), value);

    this.grid.insertTile(tile);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function actuate() {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  window.location.hash = `#${this.gameSeed},${this.moves}`;

  this.actuator.actuate(this.grid, {
    score: this.score,
    over: this.over,
    won: this.won,
    bestScore: this.storageManager.getBestScore(),
    terminated: this.isGameTerminated(),
  });
};

// Represent the current game as an object
GameManager.prototype.serialize = function serialize() {
  return {
    grid: this.grid.serialize(),
    score: this.score,
    over: this.over,
    won: this.won,
    keepPlaying: this.keepPlaying,
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function prepareTiles() {
  this.grid.eachCell((x, y, tile) => {
    if (tile) {
      /* eslint-disable no-param-reassign */ // FIXME
      tile.mergedFrom = null;
      /* eslint-enable no-param-reassign */
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function moveTile(tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function move(direction) {
  // 0: up, 1: right, 2: down, 3: left
  const self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  const vector = this.getVector(direction);
  const traversals = this.buildTraversals(vector);
  let moved = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach((x) => {
    traversals.y.forEach((y) => {
      const cell = { x, y };
      const tile = self.grid.cellContent(cell);

      if (tile) {
        const positions = self.findFarthestPosition(cell, vector);
        const next = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          const merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile();
    this.moves += 'urdl'[direction];
    this.pushHistory();

    if (!this.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate();
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function getVector(direction) {
  // Vectors representing tile movement
  const map = {
    0: { x: 0, y: -1 }, // Up
    1: { x: 1, y: 0 },  // Right
    2: { x: 0, y: 1 },  // Down
    3: { x: -1, y: 0 }, // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function buildTraversals(vector) {
  const traversals = { x: [], y: [] };

  for (let pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function findFarthestPosition(cellInput, vector) {
  let previous;
  let cell = cellInput;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (
    this.grid.withinBounds(cell) &&
    this.grid.cellAvailable(cell)
  );

  return {
    farthest: previous,
    next: cell, // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function movesAvailable() {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function tileMatchesAvailable() {
  const self = this;

  for (let x = 0; x < this.size; x++) {
    for (let y = 0; y < this.size; y++) {
      const tile = this.grid.cellContent({ x, y });

      if (tile) {
        for (let direction = 0; direction < 4; direction++) {
          const vector = self.getVector(direction);
          const cell = { x: x + vector.x, y: y + vector.y };

          const other = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function positionsEqual(first, second) {
  return first.x === second.x && first.y === second.y;
};

GameManager.prototype.pushHistory = function pushHistory() {
  this.history.push(this.grid.serialize().cells);
};

GameManager.prototype.popHistory = function popHistory() {
  // Ignore if there won't be any state left.
  if (this.history.length <= 1) {
    return;
  }

  const prevState = this.history.pop();
  const currState = this.history[this.history.length - 1];

  this.grid.cells = this.grid.fromState(currState);

  for (let x = 0; x !== this.size; x++) {
    for (let y = 0; y !== this.size; y++) {
      const prevTile = prevState[x][y];
      const currTile = currState[x][y];

      if (prevTile && currTile && prevTile.value === currTile.value) {
        this.grid.cells[x][y].savePosition();
      }
    }
  }

  this.moves = this.moves.slice(0, this.history.length - 1);

  this.actuate();
};

GameManager.prototype.updateFromHash = function updateFromHash() {
  const [gameSeed, moves] = window.location.hash.slice(1).split(',');

  if (gameSeed !== this.gameSeed || moves !== this.moves) {
    this.gameSeed = gameSeed;
    this.moves = moves;

    this.setup();
  }
};

module.exports = GameManager;
