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

user_format = '<li><div id="user_{1}" class="user">{0}</li>';
channel_content_format = '<div class="channel_content" id="{0}"><ul class="messages"></ul></div>'
channel_format = '<li><div id="cn{1}" class="channel_name">#{0}</li>';
line_format = '<li><div class="message-obj" user_id="{3}"><div class="timestamp">{0}</div><div id="line"><div class="username">{1}</div> <div class="message">{2}</div></div></div></li>';
attach_format = '<a href="{0}">Attachment #{1}</a></br>'
cur_shown_id = null;
scrollbars = {};

function convert_epoch_to_date(ms) {
    var d = new Date(0);
    d.setUTCSeconds(ms/1000);
    return d.format("mm/dd/yy hh:MM TT");
}

window.onload=function(){
    var converter = new showdown.Converter();
    converter.setOption('omitExtraWLInCodeBlocks', true);
    converter.setOption('simplifiedAutoLink', true);
    ds = deepstream('https://cfensi.discord.rambint.com:6020').login();
    chan_record = ds.record.getRecord('cfensi/channels/');
    cache_record = ds.record.getRecord('cfensi/cache/');
    channels_past_loaded = [];

    channel_scroll_bar = new IScroll($('#channels-holder')[0], {
                                mouseWheel: true,
                                scrollbars: true
                            });
    user_scroll_bar = new IScroll($('#users-holder')[0], {
                                mouseWheel: true,
                                scrollbars: true
                            });

    function add_no_check(msg) {
        md_content = converter.makeHtml(msg["message"].trim()).replace(/(?:\r\n|\r|\n)/g, '<br/>');

        attachment_str = "";
        msg["attachments"].forEach(function(attach, i) {
            attachment_str += attach_format.format(attach.url, i+1);
        });

        md_content += attachment_str;
        line_str = $(line_format.format(convert_epoch_to_date(msg["timestamp"]), msg["user"], md_content, msg["user_id"]));
        line_str.find('a').attr("target","_blank");

        ele = $('#'+msg["channel_id"]+'>.messages').append(line_str);
        // console.log(md_content);
        // $('#'+msg["channel_id"]+'>.messages').parent().scrollTop($('#'+msg["channel_id"]+'>.messages')[0].scrollHeight);
        scrollbars[msg["channel_id"]].refresh();
        scrollbars[msg["channel_id"]].scrollTo(0, scrollbars[msg["channel_id"]].maxScrollY, 0);
    }

    function add(msg){
        console.log(msg, (channels_past_loaded.indexOf(msg["channel_id"])));
        if (channels_past_loaded.indexOf(msg["channel_id"]) >= 0) {
            add_no_check(msg);
        }
    }

    cache_record.whenReady(function() {
        past_msgs = cache_record.get();
        for (c_id in past_msgs) {
            past_msgs[c_id].past.forEach(add_no_check);
            if (channels_past_loaded.indexOf(past_msgs[c_id].id) < 0) {
                channels_past_loaded.push(past_msgs[c_id].id); 
            }
        }
        console.log("loaded all past_msgs");
    });

    chan_record.subscribe('channels', function(msg){
        $('#channels').html("");
        msg.channels.forEach(function(m, i) {
            if (m != null) {
                // still need to figure out how to deal with removed channels
                f = $('#chat').find('#'+m.id);
                if (f.length == 0) {
                    $('#chat').append(channel_content_format.format(m.id));
                    scrollbars[m.id] = new IScroll($('#'+m.id)[0], {
                            mouseWheel: true,
                            scrollbars: true
                        });
                }

                if (cur_shown_id != null && i > 0) {
                    $('#'+m.id).addClass('hidden');
                } else {
                    cur_shown_id = m.id;
                }

                if (m.type == 'text') {
                    var e = $(channel_format.format(m.name, m.id)); 
                    e.click(function() {
                        $('#'+cur_shown_id).addClass('hidden');
                        $('#'+m.id).removeClass('hidden');

                        $('#cn'+cur_shown_id).removeClass('channel_name_highlighted');
                        $('#cn'+m.id).addClass('channel_name_highlighted');

                        // $('#'+m.id+'>.messages').parent().scrollTop($('#'+m.id+'>.messages')[0].scrollHeight);
                        scrollbars[m.id].refresh();
                        scrollbars[m.id].scrollTo(0, scrollbars[m.id].maxScrollY, 0);
                        // scrollbars[m.id].scrollTo($('#'+m.id+'>.messages')[0].scrollHeight);

                        console.log(cur_shown_id, m.id);
                        cur_shown_id = m.id;
                    });
                    $('#channels').append(e);
                }

                $('#cn'+cur_shown_id).addClass('channel_name_highlighted');

                if (channels_past_loaded.indexOf(m.id) < 0) {
                    past_msgs = cache_record.get(m.id);
                    if (past_msgs) {
                        past_msgs.past.forEach(add_no_check);
                        console.log("sub", m.id);
                        channels_past_loaded.push(m.id);
                    }
                }
            }
        });

        channel_scroll_bar.refresh();
    });

    chan_record.subscribe('users', function(msg){
        $('#users').html("");

        msg = msg.users.filter(function(e) {return e != undefined});

        msg.sort(function(a, b) {
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
            return 0
        });

        msg.forEach(function(m, i) {
            if (m != null) {
                $('#users').append(user_format.format(m.name, m.id));
            }
        });

        user_scroll_bar.refresh();
    });

    ds.event.subscribe('cfensi/channel/messages', add);
}