const {createServer} = require("http")
const {createReadStream} = require("fs")
const {createWriteStream} = require("fs")
const {stat, readdir} = require("fs").promises
const {rmdir, unlink} = require("fs").promises
const {mkdir} = require("fs").promises
const {parse} = require("url")
const {resolve, sep} = require("path")
const baseDirectory = process.cwd()
const mime = require("mime")

const methods = {
    GET: async function (request) {
        let path = urlPath(request.url)
        let stats
        try {
            stats = await stat(path)
        } catch (error) {
            if (error.code != "ENOENT") throw error
            else return {status: 400, body: "Файл не найден"}
        }
        if (stats.isDirectory()) {
            return {body: (await readdir(path)).join("\n")}
        } else {
            return
            {
                body: createReadStream(path)
                type: mime.getType(path)
            }
        }
    },
    DELETE: async function (request) {
        let path = urlPath(request.url)
        let stats
        try {
            stats = await stat(path)
        } catch (error) {
            if (error.code != "ENOENT") throw error
            else return {status: 204}
        }
        if (stats.isDirectory()) await rmdir(path)
        else await unlink(path)
        return {status: 204}
    },
    PUT: async function (request) {
        let path = urlPath(request.url)
        await pipeStream(request, createWriteStream(path))
        return {status: 204}
    },
    MKCOL: async function (request) {
        let path = urlPath(request.url)
        let stats
        try {
            stats = await stat(path)
        } catch (error) {
            if (error.code != "ENOENT") throw error
            await mkdir(path)
            return {status: 204}
        }
        if (stats.isDirectory()) return {status: 204}
        else return {status: 400, body: "Not a directory"}
    }
}

createServer((request, response) => {
    let handler = methods[request.method] || notAllowed
    handler(request)
        .catch(error => {
            if (error.status != null) return error
            return {body: String(error), status: 500}
        })
        .then(({body, status = 200, type = "text/plain"}) => {
            response.writeHead(status, {"Content-Type": type})
            if (body && body.pipe) body.pipe(response)
            else response.end(body)
        })

}).listen(8000)

function urlPath(url) {
    let {pathname} = parse(url)
    let path = resolve(decodeURIComponent(pathname).slice(1))
    if (path != baseDirectory &&
        !path.startsWith(baseDirectory + sep)) {
        throw {status: 400, body: "Forbidden"}
    }
    return path
}

function pipeStream(from, to) {
    return new Promise((resolve, reject) => {
        from.on("error", reject)
        to.on("error", reject)
        to.on("finish", resolve)
        from.pipe(to)
    })
}

async function notAllowed(request) {
    return {
        status: 405,
        body: `Метод ${request.method} не доступен`
    }
}