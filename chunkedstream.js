var EventEmitter = require('events').EventEmitter;
exports = module.exports = ChunkedStream;

function noop() {}

require('util').inherits(ChunkedStream, EventEmitter);
function ChunkedStream() {
    if (!(this instanceof ChunkedStream)) return new ChunkedStream();
    EventEmitter.call(this);

    this.buffers = [];
    this.queue = [];
    this.process = this.process.bind(this);
}

// Emulate the buffer interface so that we can pipe into a ChunkedStream.
ChunkedStream.prototype.readable = true;
ChunkedStream.prototype.writable = true;

ChunkedStream.prototype.write = function(buffer) {
    this.buffers.push(buffer);
    process.nextTick(this.process);
};

ChunkedStream.prototype.end = function() {
    this.readable = false;
    this.writable = false;
};

ChunkedStream.prototype.destroy = function() {
    this.buffers = [];
    this.queue = [];
    this.end();
};

ChunkedStream.prototype.destroySoon = ChunkedStream.prototype.destroy;

ChunkedStream.prototype.pause = noop;
ChunkedStream.prototype.resume = noop;
ChunkedStream.prototype.pipe = noop;

ChunkedStream.prototype.process = function() {
    while (this.queue.length) {
        var task = this.queue[0];
        if (task.type === 'line') {
            var line = this._nextLine();
            // .process() is invoked again when more data arrives.
            if (line === undefined) return;
            this.queue.shift().complete(line);
        }
        else {
            // .process() is invoked again when more data arrives.
            if (this.buffers.length <= 0) return;
            else {
                var buffer = this.buffers[0];
                if (buffer.length >= task.bytes) {
                    // Request can be fully satisfied from this buffer.
                    this.buffers[0] = buffer.slice(task.bytes, buffer.length);
                    task.chunk(buffer.slice(0, task.bytes));
                    this.queue.shift().complete();
                }
                else {
                    // Request can only be partially satisfied from this buffer.
                    task.bytes -= buffer.length;
                    this.buffers.shift();
                    task.chunk(buffer);
                }
            }
        }
    }
};

/**
 * Gets the next line up to CRLF.
 *
 * @return
 *   The line when there is one, undefined otherwise.
 */
ChunkedStream.prototype._nextLine = function() {
    var bid = 0;
    var buffer = this.buffers[bid];

    while (buffer) {
        var cursor = 0;

        while (cursor < buffer.length) {
            if (buffer[cursor++] === 13 /* \r */) {
                // This potentially is a line ending. Now we only need \n as
                // next char. Make sure that we're not at the end of a buffer.
                if (cursor >= buffer.length) {
                    buffer = this.buffers[++bid];
                    if (!buffer) return;
                    cursor = 0;
                }

                if (buffer && buffer[cursor] === 10 /* \n */) {
                    // We found a line ending.
                    cursor++;

                    // Concat buffers if we have multiple.
                    if (bid) {
                        var str = '';
                        for (var i = 0; i < bid; i++) {
                            // Concat buffers we consumed to the end and remove
                            // them from the list.
                            var b = this.buffers.shift();
                            str += b.toString('ascii');
                        }
                        var result = str + buffer.toString('ascii', 0, cursor);
                    }
                    else {
                        // All is in a single buffer.
                        var result = buffer.toString('ascii', 0, cursor);
                    }

                    this.buffers[0] = buffer.slice(cursor, buffer.length);
                    return result;
                }
            }
        }

        // buffer ended, get next buffer and continue with loop.
        buffer = this.buffers[++bid];
    }
};

ChunkedStream.prototype.getLine = function(complete) {
    this.queue.push({
        type: 'line',
        complete: complete || noop
    });
    process.nextTick(this.process);
};

ChunkedStream.prototype.getBytes = function(bytes, chunk, complete) {
    if (!bytes) {
        // Filter out requests for 0 bytes.
        (complete || noop)();
    }
    else {
        this.queue.push({
            type: 'bytes',
            bytes: bytes || 0,
            chunk: chunk || noop,
            complete: complete || noop
        });
        process.nextTick(this.process);
    }
};
