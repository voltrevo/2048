module.exports = (board) => {
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
