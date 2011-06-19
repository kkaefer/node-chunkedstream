# ChunkedStream

ChunkedStream simplifies implementing line-based protocols by providing an interface to obtain lines and fixed-length buffers from a streaming source. It acquires input by acting as a target for a piped stream.

## Usage

```javascript
var ChunkedStream = require('chunkedstream');

var cs = new ChunkedStream();
socket.pipe(cs);  // obtain socket e.g. by opening a network connection

cs.getLine(function(line) {
    // line a line terminated with \r\n
});
```

Note that `.getLine()` will only call the callback once. If you want to read lines repeatedly, you have to call `.getLine()` again from the callback.

To obtain a fixed number of bytes from the stream:

```javascript
cs.getBytes(512, onchunk, oncomplete);

function onchunk(buffer) {
    // Called repeatedly with a buffer as they come in.
    // The total combined length of all buffer objects passed to this function
    // is 512 bytes as specified above.
}

function oncomplete() {
    // Called after onchunk() has been called with total combined buffer
    // length of 512 bytes.
}
```

**Note**: When the stream never contains `\r\n`, `getLine` will never call the callback function.