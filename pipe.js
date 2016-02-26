deepstream = require('deepstream.io-client-js')
prompt = require('prompt');
var fs = require('fs');

if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

process.on('SIGINT', function() {
  socket.close();
  process.exit();
});

ds = deepstream('127.0.0.1:6021').login();

var cache = {
    channel_messages: {},
}
var Discord = require("discord.js");
var mybot = new Discord.Client();

var user = JSON.parse(fs.readFileSync('user.json', 'utf8'));
if ("user" in user && "pass" in user) {
    mybot.login(user.user, user.pass);
} else {
    process.exit(1);
}
run_on_server_id = ["151513166323515392"];
// run_on_server_id = ["81384788765712384"];
users_cache = {};
chan_record = ds.record.getRecord('cfensi/channels/');
cache_record = ds.record.getRecord('cfensi/cache/');

function convert_message(message) {
    return {
            "user": message.author.name,
            "user_id": message.author.id,
            "channel": message.channel.name,
            "channel_id": message.channel.id,
            "message": message.cleanContent,
            "attachments": message.attachments,
            "embeds": message.embeds,
            "timestamp": message.timestamp,
           };
}

function find_server_members(id, callback) {
    mybot.servers.forEach(function(s) {
        if (s.id == id) {
            callback(s.members);
        }
    });
}

function update_channels(cb) {
    if (typeof(cb)==='undefined') cb = function(){};

    channels = mybot.channels;
    send_data = channels.map(function(e) {
        if (run_on_server_id.indexOf(e.server.id) >= 0) {
            return {"id": e.id, "name": e.name, "type": e.type}
        }
    });
    // console.log("channel:" + send_data);
    chan_record.set('channels', {"channels": send_data});
    
    cb(channels);
}

function users_update_users(old, update) {
    console.log("Updated members due to presence");
    if (update.id in users_cache) {
        s_id = users_cache[update.id].server;
        if (run_on_server_id.indexOf(s_id) >= 0) {
            users_cache[update.id] = {"id": update.id, "name": update.name, "game": update.game, "status": update.status, "server": s_id};;
            send_update_users();
        }
    }
}

function server_update_users(server, update) {
    console.log("Updated members due to update");
    users_cache[update.id] = {"id": update.id, "name": update.name, "game": update.game, "status": update.status, "server": server.id};;
    send_update_users();
}

function send_update_users() {
    send_data = [];
    for (key in users_cache) {
        if (users_cache[key].status != 'offline') {
            send_data.push(users_cache[key]);
        }
    }

    // console.log(send_data);
    chan_record.set('users', {'users': send_data});
}

function update_users() {
    find_server_members(run_on_server_id[0], function(users) {
        send_data = [];
        users.forEach(function(e) {
            users_cache[e.id] = {"id": e.id, "name": e.name, "game": e.game, "status": e.status, "server": run_on_server_id[0]};
            if (e.status != 'offline') {
                send_data.push(users_cache[e.id]);
            }
        });
        console.log(send_data);
        chan_record.set('users', {'users': send_data});
    });
}

function get_channel_logs(channels) {
    channels.forEach(function(c) {
        if (run_on_server_id.indexOf(c.server.id) >= 0) {
            mybot.getChannelLogs(c, 500).then(function (data) {
                formated_data = data.map(function(msg) {
                    return convert_message(msg);
                });
                formated_data.reverse();
                cache['channel_messages'][c.id.toString()] = formated_data;
                console.log(c.id, c.name + ": " + cache['channel_messages'][c.id].length + " - " + Object.keys(cache['channel_messages']).length);
                cache_record.set(c.id, {"past": cache['channel_messages'][c.id.toString()], "id": c.id});
            });
        }
    });
}

mybot.on("channelCreated", update_channels);
mybot.on("channelDeleted", update_channels);
mybot.on("presence", users_update_users);
mybot.on("serverNewMember", server_update_users);
mybot.on("serverMemberRemoved", server_update_users);

mybot.on("ready", function() {
    console.log("ready");
    update_channels(get_channel_logs);
    update_users();
});

mybot.on("message", function(message) {
    if (run_on_server_id.indexOf(message.channel.server.id) >= 0) {
        m_id = message.channel.id.toString();
        if (!(m_id in cache["channel_messages"])) {
            cache["channel_messages"][m_id] = []
        }

        out = convert_message(message);

        if (cache["channel_messages"][m_id].indexOf(out) < 0) {
            cache["channel_messages"][m_id].push(out);
            if (cache["channel_messages"][m_id].length > 500) {
                cache["channel_messages"][m_id].shift();
            }

            console.log(m_id, cache_record.get(m_id).length);
            cache_record.set(m_id, {"past": cache['channel_messages'][m_id.toString()], "id": m_id});
        }
        ds.event.emit('cfensi/channel/messages', out);
        console.log("message {0}: {1} - {2} ({3})".format(message.timestamp, out["user"], out["channel"], cache['channel_messages'][m_id].length));
    }
});
