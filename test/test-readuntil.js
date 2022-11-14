const chai = require("chai"),
      Stream = require("stream"),
      StreamHelper = require('..')

chai.use(require("chai-as-promised"));

describe("readUntil", function(){
    it("should read until newline", function(){
        const stream = new Stream.PassThrough()
        const ret = StreamHelper.streamReadUntil(stream, chunk=>chunk.toString() == "\n")
        stream.write('Hello World\n')
        
        return chai.expect(ret.then(a=>a.toString("utf8"))).to.eventually.equal("Hello World\n")
    })
    it("should read until newline and no further", async function(){
        const stream = new Stream.PassThrough()
        let ret = StreamHelper.streamReadUntil(stream, chunk=>chunk.toString() == "\n")
        stream.write("Hello World\nThis is not for us\n")
        
        await chai.expect(ret.then(a=>a.toString("utf8"))).to.eventually.equal("Hello World\n")

        ret = StreamHelper.streamReadUntil(stream, chunk=>{
            return chunk.toString() == "\n"
        })

        await chai.expect(ret.then(a=>a.toString("utf8"))).to.eventually.equal("This is not for us\n")
    })
    it("should read until stream end", async function(){
        const stream = new Stream.PassThrough()
        let ret = StreamHelper.streamReadUntil(stream, null)
        stream.write("Hello World\nThis is not for us\n")
        stream.end()
        await chai.expect(ret.then(a=>a.toString("utf8"))).to.eventually.equal("Hello World\nThis is not for us\n")
    })
    it("should read until stream close", async function(){
        const stream = new Stream.PassThrough()
        let ret = StreamHelper.streamReadUntil(stream, null)
        stream.write("Hello World\nThis is not for us\n")
        stream.emit('close')
        await chai.expect(ret.then(a=>a.toString("utf8"))).to.eventually.equal("Hello World\nThis is not for us\n")
    })
})