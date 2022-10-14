const Q = require('@halleyassist/q-lite'),
      EndOfStreamError = require('./EndOfStreamError')

const DefaultTimeout = -1

class StreamReader {
    constructor(s) {
        if (!s.read || !s.once) {
            throw new Error('Expected an instance of stream.Readable');
        }

        // our stream state
        this._peekQueue = []
        this._endOfStream = false;
        this._s = s
        this._deferred = Q.defer()

        // listen for stream end events
        this._s.once('end', () => this._reject(new EndOfStreamError()));
        this._s.once('error', err => this._reject(err));
        this._s.once('close', () => this._reject(new Error('Stream closed')));
    }

    get baseStream() {
        return this._s
    }

    /**mi
     * Read from stream until end of stream is reached or until the callback return true
     * If fn is a function read until fn returns true
     * Otherwise read until end of stream
     */
    readUntil(buffer = null, fn = null, timeout = DefaultTimeout){
        let cancel
        const ret = this._readUntil(buffer, fn, timeout, c=>{ cancel = c })
        ret.cancel = cancel
        return ret
    }

    async _readUntil(buffer = null, fn = null, timeout = DefaultTimeout, cancelFn = ()=>{}){
        let ret = Buffer.alloc(0)
        
        if(!buffer) buffer = Buffer.alloc(1024)
        do {
            try {
                const bytesRead = await this._read(buffer, 0, 0, timeout, cancelFn);
                if(fn) {
                    for(let i=0; i<bytesRead; i++) {
                        if(fn(buffer[i])) {
                            ret = Buffer.concat([ret, buffer.slice(0, i+1)])
                            if(i < bytesRead - 1) {
                                // Put unread data back to peek buffer
                                this._peekQueue.push(buffer.slice(i+1, bytesRead))
                            } 
                            return ret
                        }
                    }
                }
                ret = Buffer.concat([ret, buffer.slice(0, bytesRead)])
            } catch(ex){
                if(ex instanceof EndOfStreamError) {
                    if(fn) {
                        if(ret.length) {
                            this._peekQueue.push(ret)
                        }
                    } else {
                        return ret
                    }
                }
                throw ex
            }
        } while(!this._endOfStream)
    }

    /**
     * Read ahead (peek) from stream. Subsequent read or peeks will return the same data
     * @param buffer - Buffer to store data read from stream in
     * @param offset - Offset target
     * @param length - Number of bytes to read
     * @returns Number of bytes peeked
     */
    async peek(buffer, offset, length, readTimeout = DefaultTimeout) {
        let cancel
        const ret = this._peek(buffer, offset, length, readTimeout, c=>{ cancel = c })
        ret.cancel = cancel
        return ret
    }

    async _peek(buffer, offset, length, readTimeout = DefaultTimeout, cancelFn = ()=>{}) {
        const bytesRead = await this._read(buffer, offset, length, readTimeout, cancelFn);
        this._peekQueue.push(buffer.slice(offset, offset + bytesRead)); // Put read data back to peek buffer
        return bytesRead;
    }

    _timeout(promise, timeout) {
        if(timeout < 0) return promise
        return Q.timeout(promise)
    }

    /**
     * Read chunk from stream
     * @param buffer - Target Buffer to store data read from stream in or if is a number a biffer will be allocated
     * @param offset - Offset target
     * @param length - Number of bytes to read
     * @returns Number of bytes read if a buffer is provided, else the allocated buffer will be returned
     */
    read(buffer, offset = 0, length = undefined, readTimeout = DefaultTimeout) {
        let cancel, ret, returnsBuffer = false
        if(!(buffer instanceof Buffer)) {
            buffer = Buffer.alloc(buffer)
            offset = 0
            length = buffer.length
            returnsBuffer = true
        }
        ret = this._read(buffer, offset, length, readTimeout, c=>{ cancel = c })
        if(returnsBuffer) ret = ret.then(()=>buffer)
        ret.cancel = cancel
        return ret
    }

    async _read(buffer, offset, length, readTimeout = DefaultTimeout, cancelFn = ()=>{}) {
        if (this._peekQueue.length === 0 && this._endOfStream) {
            throw new EndOfStreamError();
        }

        let readSize = length ? length : 0
        let remaining = length ? length : (buffer.length - offset);
        let bytesRead = 0;
        // consume peeked data first
        while (this._peekQueue.length > 0 && remaining > 0) {
            const peekData = this._peekQueue.pop(); // Front of queue
            if (!peekData) throw new Error('peekData should be defined');
            const lenCopy = Math.min(peekData.length, remaining, buffer.length);
            peekData.slice(0, lenCopy).copy(buffer, offset + bytesRead);
            bytesRead += lenCopy;
            remaining -= lenCopy;
            if(readSize) readSize  -= lenCopy
            if (lenCopy < peekData.length) {
                // remainder back to queue
                this._peekQueue.push(peekData.slice(lenCopy));
            }
        }
        // continue reading from stream if required
        if (remaining > 0 && !this._endOfStream) {
            let wait = true
            if(!readSize && bytesRead) {
                wait = false
            }
            const chunkLen = await this._timeout(this._readFromStream(buffer, offset + bytesRead, readSize, wait, cancelFn), readTimeout);
            bytesRead += chunkLen;
        }
        return bytesRead;
    }

    /**
     * Read chunk from stream
     * @param buffer Target Buffer to store data read from stream in
     * @param offset Offset target
     * @param length Number of bytes to read
     * @returns Number of bytes read
     */
    async _readFromStream(buffer, offset, length, wait, cancelFn) {
        let ret = 0
        do {
            const readBuffer = this._s.read();
            if(readBuffer === null) {
                if(!wait) break
                const deferred = Q.defer()
                this._s.once('readable', deferred.resolve)
                cancelFn(()=>{ 
                    this._s.removeListener('readable', deferred.resolve)
                    deferred.reject(new Error('Cancelled'))
                })
                try  {
                    await Q.safeRace([deferred.promise, this._deferred.promise])
                } catch (ex){
                    if(ex instanceof EndOfStreamError) {
                        throw new EndOfStreamError()
                    }
                    throw ex
                }
            } else {
                let readLen = Math.min(readBuffer.length, buffer.length - offset);
                if(length > 0 && length < readLen) readLen = length

                readBuffer.copy(buffer, offset, 0, readLen);
                if(readLen != readBuffer.length) {
                    this._peekQueue.push(readBuffer.slice(readLen));
                }
                if(length) length -= readLen;
                offset += readLen;
                ret += readLen;
            }
        } while(length != 0)
        
        return ret
    }

    _reject(err) {
        this._endOfStream = true;
        if (this._deferred) {
            this._deferred.reject(err);
        }
    }
}
module.exports = StreamReader