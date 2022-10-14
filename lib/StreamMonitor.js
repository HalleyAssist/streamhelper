class StreamMonitor {
    static monitorStream(stream, obj){
        if(process.env.STREAM_MONITOR == 'y'){
            let e2 = stream.emit
            stream.emit = function(eventName, arg){
                console.log({obj, eventName})
                e2.call(this, eventName, arg)
            }
        }
        return stream
    }
}
module.exports = StreamMonitor