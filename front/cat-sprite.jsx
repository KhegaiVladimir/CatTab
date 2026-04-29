// Pixel cat sprite — built from squares only (CSS box-shadow grid).
// Renders a small ginger tabby. Variants: 'idle' | 'eat' | 'play' | 'sleep'.

const CAT_PIXELS = {
  idle: [
    "..XX......XX..",
    ".X..X....X..X.",
    ".X..XXXXXX..X.",
    ".X.OXXXXXXO.X.",
    "XXXXXXXXXXXXXX",
    "X..XXXXXXXX..X",
    "X.XXXXXXXXXX.X",
    "XXX.X....X.XXX",
    "XXXXXXXXXXXXXX",
    "X.XXXXXXXXXX.X",
    "X.XXXXXXXXXX.X",
    ".X.X.X..X.X.X.",
    ".X.X.X..X.X.X.",
    "..XXXX..XXXX..",
  ],
  eat: [
    "..XX......XX..",
    ".X..X....X..X.",
    ".X..XXXXXX..X.",
    ".X.OXXXXXXO.X.",
    "XXXXXXXXXXXXXX",
    "X..XXX..XXX..X",
    "X.XXXFFFFXXX.X",
    "XXX.FFFFFF.XXX",
    "XXXXFFFFFFXXXX",
    "X.XXXXXXXXXX.X",
    "X.XXXXXXXXXX.X",
    ".X.X.X..X.X.X.",
    ".X.X.X..X.X.X.",
    "..XXXX..XXXX..",
  ],
  play: [
    "..XX......XX..",
    ".X..X....X..X.",
    ".X..XXXXXX..X.",
    ".X.^XXXXXX^.X.",
    "XXXXXXXXXXXXXX",
    "X.XXXXXXXXXX.X",
    "X.XXXXXXXXXX.X",
    "XXX.XOOOO.XXXX",
    "XXXXXOOOOXXXXX",
    "X.XXXXXXXXXX.X",
    "X.XXXXXXXXXX.X",
    ".X.X.X..X.X.X.",
    ".X.X.X..X.X.X.",
    "..XXXX..XXXX..",
  ],
  sleep: [
    "..............",
    "..............",
    "..XXXXXXXXXX..",
    ".X..........X.",
    ".X.--..--...X.",
    "XXXXXXXXXXXXXX",
    "X.XXXXXXXXXX.X",
    "X.XXX....XXX.X",
    "XXXXXXXXXXXXXX",
    "X.XXXXXXXXXX.X",
    "X.XXXXXXXXXX.X",
    "..XXXXXXXXXX..",
    "..............",
    "..............",
  ],
};

// Color map for the pixel chars
const PIXEL_COLORS = {
  X: "#E89464", // ginger fur
  O: "#2A2520", // eyes
  F: "#F2D7C2", // food/mouth open lighter
  "^": "#2A2520", // closed eye
  "-": "#2A2520", // sleeping eye line
  ".": "transparent",
};

function PixelCat({ variant = "idle", scale = 4, style = {} }) {
  const grid = CAT_PIXELS[variant] || CAT_PIXELS.idle;
  const rows = grid.length;
  const cols = grid[0].length;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${scale}px)`,
        gridTemplateRows: `repeat(${rows}, ${scale}px)`,
        width: cols * scale,
        height: rows * scale,
        imageRendering: "pixelated",
        ...style,
      }}
    >
      {grid.flatMap((row, y) =>
        row.split("").map((ch, x) => (
          <div
            key={`${x}-${y}`}
            style={{
              width: scale,
              height: scale,
              background: PIXEL_COLORS[ch] || "transparent",
            }}
          />
        ))
      )}
    </div>
  );
}

// Tiny inline 16px version for the header badge
function PixelCatTiny({ size = 16 }) {
  const scale = size / 14;
  return <PixelCat variant="idle" scale={scale} />;
}

window.PixelCat = PixelCat;
window.PixelCatTiny = PixelCatTiny;
