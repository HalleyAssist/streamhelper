const Q = require('@halleyassist/q-lite'),
      assert = require('assert')

const DefaultTimeout = 100

const StreamHelper = {
    _streamWrite: async function(stream, buffer, cancelFn = ()=>{}){
        if(stream.destroyed) throw new Error(`Stream is already destroyed`)
        const deferred = Q.defer()
        cancelFn(()=>deferred.reject('cancelled'))
        let isRejected = false
        const ret = stream.write(buffer, err=>{
            if(err) {
                isRejected = true
                return deferred.reject(err)
            }
        })

        // shortcut
        if(ret) {
            if(isRejected) await deferred.promise
            return
        }
        
        // wait on drain and try again
        const doDrain = function(){
            deferred.resolve(StreamHelper._streamWrite(stream, buffer, cancelFn))
        }
        stream.once('drain', doDrain)

        // waiting oon the end of the write op
        try {
            return await deferred.promise
        } finally {
            stream.removeListener('drain', doDrain)
        }
    },
    streamWrite: function(stream, buffer){
        let cancel
        const ret = StreamHelper._streamWrite(stream, buffer, c=>{ cancel = c })
        ret.cancel = cancel
        return ret
    },
    _streamRead: async function(stream, length, cancelFn = ()=>{}, timeout = DefaultTimeout){
        if(stream.destroyed) throw new Error(`Stream is already destroyed`)
        const deferred = Q.defer()
        let chunks = []
        let received = 0
        const doReadable = () => {
            let chunk;
            while (null !== (chunk = stream.read(length))) {
                assert(chunk.length <= length)
                chunks.push(chunk)
                length -= chunk.length
                received += chunk.length
                if(length <= 0){
                    deferred.resolve(Buffer.concat(chunks))
                    break
                }
            }
        }
        stream.on('readable', doReadable)
        if(stream.readableLength){
            doReadable()
        }
        
        const doClose = (start = 'Clos')=>{
            doReadable()
            deferred.reject(new Error(`${start}ing due to insufficient data after receiving ${received}/${received+length}`))
        }
        stream.once('close', doClose)

        const doEnd = ()=>{
            Q.delay(timeout).then(()=>doClose('End'))
        }
        stream.once('end', doEnd)

        deferred.promise.catch(()=>{}).then(()=>{
            stream.removeListener('readable', doReadable)
            stream.removeListener('close', doClose)
            stream.removeListener('end', doEnd)
        })

        cancelFn(()=>deferred.reject('cancelled'))

        return await deferred.promise
    },
    streamRead: function(stream, length){
        let cancel
        const ret = StreamHelper._streamRead(stream, length, c=>{ cancel = c })
        ret.cancel = cancel
        return ret
    },
    _streamReadUntil: async function(stream, fn = null, cancelFn = ()=>{}, timeout = DefaultTimeout){
        // read until end
        const deferred = Q.defer()
        let ret = Buffer.alloc(0), ended = false, doExtraEnd
        if(!fn) {
            doExtraEnd = ()=>{
                ended = true
                deferred.resolve(ret)
            }
            stream.once('end', doExtraEnd)
            fn = ()=>ended
        }

        let chunk
        const doReadable = async () => {
            try {
                let c
                while (null !== (c = stream.read(1))) {
                    chunk = c
                    ret = Buffer.concat([ret, chunk])
                    if(fn(chunk)) {                
                        deferred.resolve(ret)
                    }
                }
            } catch(ex){
                deferred.reject(ex)
            }
        }
        stream.on('readable', doReadable)
        if(stream.readableLength){
            doReadable()
        }
        
        const doClose = async (start = 'Clos')=>{
            doReadable()
            ended = true
            if(chunk && fn(chunk)) {                
                deferred.resolve(ret)
            }
            deferred.reject(new Error(`${start}ing due to insufficient data after receiving ${ret.length}`))
        }
        stream.once('close', doClose)

        const doEnd = ()=>{
            if(ended) return
            Q.delay(timeout).then(()=>doClose('End'))
        }
        stream.once('end', doEnd)

        deferred.promise.catch(()=>{}).then(()=>{
            stream.removeListener('readable', doReadable)
            stream.removeListener('close', doClose)
            stream.removeListener('end', doEnd)
            if(doExtraEnd)  stream.removeListener('end', doExtraEnd)
        })

        cancelFn(()=>deferred.reject('cancelled'))

        return await deferred.promise
    },
    streamReadUntil: function(stream, fn = null){
        let cancel
        const ret = StreamHelper._streamReadUntil(stream, fn, c=>{ cancel = c })
        ret.cancel = cancel
        return ret
    },
    _lingeringClose: async function(stream, ignoreDestroyed = false, cancelFn = ()=>{}){
        if(stream.destroyed) {
            if(ignoreDestroyed) return
            throw new Error(`Stream is already destroyed`)
        }
        let deferred = Q.defer()
        stream.end()
        let timer = setTimeout(deferred.resolve, 3000)
        stream.on('data', function(){
            if(!stream.destroyed){
                if(timer) clearTimeout(timer)
                timer = setTimeout(deferred.resolve, 3000)
            }
        })

        cancelFn(()=>deferred.reject('cancelled'))
        try {
            const ret = await deferred.promise
            if(!stream.destroyed){
                stream.destroy()
            }
            return ret
        } finally {
            if(timer) clearTimeout(timer)
        }
    },
    lingeringClose: function(stream, ignoreDestroyed = false){
        let cancel
        const ret = StreamHelper._lingeringClose(stream, ignoreDestroyed, c=>{ cancel = c })
        ret.cancel = cancel
        return ret
    },
    monitorStream: function(stream, obj){
        if(process.env.STREAM_MONITOR == 'y'){
            let e2 = stream.emit
            stream.emit = function(eventName, arg){
                console.log({obj, eventName})
                e2.call(this, eventName, arg)
            }
        }
        return stream
    },
    drainWait: function(stream){
        const drainWait = Q.defer()
        stream.once('drain', drainWait.resolve)
        drainWait.promise.cancel = function(){
            stream.removeListener('drain', drainWait.resolve)
            drainWait.reject('cancelled')
        }
        return drainWait.promise
    }
}

module.exports = StreamHelper