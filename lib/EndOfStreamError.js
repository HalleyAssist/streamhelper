/**
 * Thrown on read operation of the end of file or stream has been reached
 */
 class EndOfStreamError extends Error {

    constructor() {
        super('End-Of-Stream');
    }
}
module.exports = EndOfStreamError