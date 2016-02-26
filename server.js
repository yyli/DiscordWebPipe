const fs = require('fs');
var DeepstreamServer = require('deepstream.io'),
    server = new DeepstreamServer();

// Optionally you can specify some settings, a full list of which
// can be found here //deepstream.io/docs/deepstream.html
server.set('host', 'rambint.com');
server.set('port', 6020);
server.set('sslCert', fs.readFileSync( '/etc/ssl/nginx/cfensi.discord.rambint.com.crt', 'utf8' ));
server.set('sslKey', fs.readFileSync( '/etc/ssl/nginx/rambint.key', 'utf8' ));

// start the server
server.start();