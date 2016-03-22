const sqrt2 = Math.sqrt(2);

module.exports = (cells) => {
  let seed = 0;

  for (let x = 0; x !== 4; x++) {
    for (let y = 0; y !== 4; y++) {
      seed += (1 + 4 * x + y) * cells[x][y];
    }
  }

  seed *= sqrt2;
  seed -= Math.floor(seed);

  return seed;
};
