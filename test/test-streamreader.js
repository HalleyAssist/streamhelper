const {assert} = require('chai'),
      chai = require("chai"),
      fs = require('fs'),
      {StreamReader, EndOfStreamError} = require('..'),
      Stream = require("stream")

chai.use(require("chai-as-promised"));

describe('Examples', () => {

    it('first example', async () => {
  
      const readable = fs.createReadStream(__dirname+'/resources/JPEG_example_JPG_RIP_001.jpg');
      const streamReader = new StreamReader(readable);
      const uint8Array = Buffer.alloc(16);
      const bytesRead = await streamReader.read(uint8Array, 0, 16);
      assert.equal(bytesRead, 16);
    });
  
    it('End-of-stream detection', async () => {
  
      const fileReadStream = fs.createReadStream(__dirname+'/resources/JPEG_example_JPG_RIP_001.jpg');
      const streamReader = new StreamReader(fileReadStream);
      const uint8Array = Buffer.alloc(16);
      assert.equal(await streamReader.read(uint8Array, 0, 16), 16);
      try {
        while(await streamReader.read(uint8Array, 0, 1) > 0);
        assert.fail('Should throw EndOfStreamError');
      } catch(error) {
        assert.isOk(error instanceof EndOfStreamError, 'Expect `error` to be instance of `EndOfStreamError`');
        if (error instanceof EndOfStreamError) {
          console.log('End-of-stream reached');
        }
      }
    });
  
    it('peek', async () => {
  
      const fileReadStream = fs.createReadStream(__dirname+'/resources/JPEG_example_JPG_RIP_001.jpg');
      const streamReader = new StreamReader(fileReadStream);
      const buffer = Buffer.alloc(20);
  
      let bytesRead = await streamReader.peek(buffer, 0, 3);
      if (bytesRead === 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        console.log('This is a JPEG file');
      } else {
        throw Error('Expected a JPEG file');
      }
      bytesRead = await streamReader.read(buffer, 0, 20); // Read JPEG header
      if (bytesRead === 20) {
        console.log('Got the JPEG header');
      } else {
        throw Error('Failed to read JPEG header');
      }
    });
  

    describe("sr.readUntil", function() {
        it("should read until newline", function(){
            const stream = new Stream.PassThrough()
            const streamReader = new StreamReader(stream);
            const ret = streamReader.readUntil(null, c=>{
                return c == "\n".charCodeAt(0)
            })
            stream.write('Hello World\n')
            
            return chai.expect(ret.then(a=>a.toString("utf8"))).to.eventually.equal("Hello World\n")
        })
        
        it("should read until newline and no further", async function(){
            const stream = new Stream.PassThrough()
            const streamReader = new StreamReader(stream);
            let ret = streamReader.readUntil(null, c=>{
                return c == "\n".charCodeAt(0)
            })
            stream.write("Hello World\nThis is not for us\n")
            
            await chai.expect(ret.then(a=>a.toString("utf8"))).to.eventually.equal("Hello World\n")

            ret = streamReader.readUntil(null, c=>{
                return c == "\n".charCodeAt(0)
            })

            await chai.expect(ret.then(a=>a.toString("utf8"))).to.eventually.equal("This is not for us\n")
        })
        it("AA should read until stream end", async function(){
            const stream = new Stream.PassThrough()
            const streamReader = new StreamReader(stream);
            let ret = streamReader.readUntil(null, null)
            stream.write("Hello World\nThis is not for us\n")
            stream.end()
            await chai.expect(ret.then(a=>a.toString("utf8"))).to.eventually.equal("Hello World\nThis is not for us\n")
        })
    })
  });