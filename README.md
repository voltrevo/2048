# 2048
This is a fork of Gabriele Cirulli's 2048 project with some changes around deterministic play and unlimited undos.

Live here: https://andrewmorris.io/2048.

# The Challenge
As you start playing, you'll notice that your moves are displayed in the url hash. This makes your game state and its history shareable ([usually](#url-hash-format)). Your mission is to produce a url with the highest score you can find.

# Headless Version
Since you are a developer, you will likely desire to separate your algorithmic number crunching domination from the fancy schmancy graphical frontend I have provided. Fear not my friend, simply add `"voltrevo-2048": "voltrevo/2048"` to your `package.json` and access the `Board` factory via:

```js
'use strict';

const Board = require('voltrevo-2048/src/Board.js');

const b = Board();

b.up();
b.down();
b.left();
b.right();

console.log(b.prettyString()); /*
  +------------+
  | 0  0  0  4 |
  | 0  0  2  0 |
  | 0  0  0  0 |
  | 0  0  4  2 |
  +------------+
*/
```

# URL Hash Format
If your move sequence becomes *very* long, it may become abbreviated using a fake url that is not shareable. The format looks like this:

`https://andrewmorris.io/2048/#<game-seed>;<move-sequence-url>;<undo-count-after-url>;<raw-moves>`

So if your `move-sequence-url` is something like `2048://wwxzcbyyzo`, that url will only work inside the page that generated it. To fix this, you can print your raw moves in the developer console with this command:

`gameManager.moveStore.resolve().then(moves => console.log(moves));`

Then, I suggest creating a url for those moves using a [github gist](https://gist.github.com/) (use the **raw** button), and then shortening it using [goo.gl](https://goo.gl/), and then you can create a shareable url like this:

`https://andrewmorris.io/2048/#<game-seed>,<url-you-created>`

**Note**: `<game-seed>` might be an empty string. That's ok.

## License
2048 is licensed under the [MIT license.](https://github.com/gabrielecirulli/2048/blob/master/LICENSE.txt)
