# 2048
This is a fork of Gabriele Cirulli's 2048 project with some changes around deterministic play and unlimited undos.

# URL Scheme
If your move sequence becomes *very* long, it may become abbreviated using a fake url that is not shareable. The format looks like this:

`https://andrewmorris.io/2048/#<game-seed>;<move-sequence-url>;<undo-count-after-url>;<raw-moves>`

So if your `move-sequence-url` is something like `2048://wwxzcbyyzo`, that url will only work inside the page that generated it. To fix this, you can print your raw moves in the developer console with this command:

`gameManager.moveStore.resolve().then(moves => console.log(moves));`

Then, I suggest creating a url for those moves using a [github gist](https://gist.github.com/) (use the **raw** button), and then shortening it using [goo.gl](https://goo.gl/), and then you can create a shareable url like this:

`https://andrewmorris.io/2048/#<game-seed>,<url-you-created>`

**Note**: `<game-seed>` might be an empty string. That's ok.

## License
2048 is licensed under the [MIT license.](https://github.com/gabrielecirulli/2048/blob/master/LICENSE.txt)
