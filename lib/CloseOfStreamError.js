/**
 * Thrown on read operation of the end of file or stream has been reached
 */
class CloseOfStreamError extends Error {

    constructor() {
        super('Stream Closed');
    }
}
module.exports = CloseOfStreamError