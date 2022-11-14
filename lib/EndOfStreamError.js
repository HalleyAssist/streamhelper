/**
 * Thrown on read operation of the end of file or stream has been reached
 */
class EndOfStreamError extends Error {
    constructor() {
        super('Stream End');
    }
}
module.exports = EndOfStreamError