require('./style/main.scss');

const Container = require('./html/container.html');

const GameManager = require('./game_manager.js');
const KeyboardInputManager = require('./keyboard_input_manager.js');
const LocalStorageManager = require('./local_storage_manager.js');
const HTMLActuator = require('./html_actuator.js');
const MoveStore = require('./MoveStore.js');

const [gameSeed = '', moves = ''] = window.location.hash.slice(1).split(',');

window.Board = require('./Board.js');

// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(() => {
  document.body.appendChild(Container());

  window.gameManager = new GameManager({
    size: 4,
    gameSeed,
    moveStore: MoveStore(moves),
    InputManager: KeyboardInputManager,
    Actuator: HTMLActuator,
    StorageManager: LocalStorageManager,
  });
});
