'use strict';

function blockTrim(str) {
  const lines = str.split('\n');

  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }

  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  const minIndent = lines
    .filter(line => line.trim() !== '')
    .map(line => line.match(/^ */)[0].length)
    .reduce((x, y) => Math.min(x, y))
  ;

  return lines
    .map(line => line.slice(minIndent))
    .join('\n')
  ;
}

module.exports = (editor) => {
  editor.setValue(blockTrim(`
    (board) => {
      const movePriority = ['right', 'down', 'up', 'left'];

      for (let i = 0; i !== movePriority.length; i++) {
        const move = movePriority[i];

        if (board[move]()) {
          return move;
        }
      }

      // Nowhere to go, but still need to return something
      return 'right';
    };
  `));

  return (board) => {
    const lines = editor.getValue().split('\n');

    while (lines.length !== 0 && lines[0].trim() === '') {
      lines.shift();
    }

    while (lines.length !== 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }

    if (
      lines.length === 0 ||
      lines[0].trim() !== '(board) => {' ||
      lines[lines.length - 1].trim() !== '};'
    ) {
      // eslint-disable-next-line
      return 'Error: Suggestion function must start with \'(board) => {\' and end with \'};\'';
    }

    lines.shift();
    lines.pop();

    let getSuggestion;

    try {
      // eslint-disable-next-line
      getSuggestion = new Function('board', lines.join('\n'));
    } catch (e) {
      // eslint-disable-next-line
      getSuggestion = () => e.stack;
    }

    return getSuggestion(board);
  };
};
