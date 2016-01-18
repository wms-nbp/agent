if (!Date.prototype.toISOString) {
    Date.prototype.toISOString = function () {
        function pad(n) { return n < 10 ? '0' + n : n; }
        function ms(n) { return n < 10 ? '00'+ n : n < 100 ? '0' + n : n }
        return this.getFullYear() + '-' +
            pad(this.getMonth() + 1) + '-' +
            pad(this.getDate()) + 'T' +
            pad(this.getHours()) + ':' +
            pad(this.getMinutes()) + ':' +
            pad(this.getSeconds()) + '.' +
            ms(this.getMilliseconds()) + 'Z';
    }
}

/*
    @param  {String} address 
    @param  {String} title 
    @param  {String} startTime
    @param  {Array}  resources
    @return {Object} | JSON object for HAR viewer 
 */
function createHAR(address, title, startTime, endTime, resources)
{
    var entries = [];
    //if(title==''){title=resources[1].request.url;}
    resources.forEach(function (resource) {
        if(!resource){return true;};
        if(resource.endReply==null){return true;};
        var request = resource.request,
            startReply = resource.startReply,
            endReply = resource.endReply;
        if (!request || !startReply || !endReply) {
            //return;
        }

        if (request.url.match(/(^data:image\/.*)/i)) {
            return;
        }
       if(!startReply){startReply={};startReply.bodySize=0;}
        entries.push({
            startedDateTime: (new Date(request.time)).toISOString(),
            time: (new Date(endReply.time)) - (new Date(request.time)),
            request: {
                method: request.method,
                url: request.url,
                httpVersion: "HTTP/1.1",
                cookies: [],
                headers: request.headers,
                queryString: [],
                headersSize: (JSON.stringify(request.headers)).length,
                bodySize: -1
            },
            response: {
                status: endReply.status,
                statusText: endReply.statusText,
                httpVersion: "HTTP/1.1",
                cookies: [],
                headers: endReply.headers,
                redirectURL: "",
                headersSize: (JSON.stringify(endReply.headers)).length,
                bodySize: startReply.bodySize,
                content: {
                    size: startReply.bodySize,
                    mimeType: endReply.contentType
                }
            },
            cache: {},
            timings: {
                blocked: 0,
                dns: -1,
                connect: -1,
                send: 0,
                wait: (new Date(startReply.time)) - (new Date(request.time)),
                receive: (new Date(endReply.time)) - (new Date(startReply.time)),
                ssl: -1
            },
            pageref: address
        });
    });

    return {
        log: {
            version: '1.2',
            creator: {
                name: "PhantomJS",
                //version: phantom.version.major + '.' + phantom.version.minor +
                //    '.' + phantom.version.patch
            },
            pages: [{
                startedDateTime: (new Date(startTime)).toISOString(),
                id: address,
                title: title,
                pageTimings: {
                    onLoad: (new Date(endTime)) - (new Date(startTime))
                }
            }],
            entries: entries
        }
    };
};

exports.createHAR = createHAR;