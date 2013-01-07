/*
  As of version 1.1.2, Propane will load and execute the contents of
  ~/Library/Application Support/Propane/unsupported/caveatPatchor.js
  immediately following the execution of its own enhancer.js file.

  You can use this mechanism to add your own customizations to Campfire
  in Propane.

  Below you'll find two customization examples.

  1 - A responder that adds avatars to your chat view
  2 - A responder that displays gists inline

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
*/

var displayAvatars = true;
var displayGists = true;

/*
  Display avatars in the chat view - based on code originally by @tmm1
*/

if (displayAvatars) {

  Object.extend(Campfire.Message.prototype, {
    addAvatar: function() {
      if (this.actsLikeTextMessage()) {
        var author = this.authorElement();
        var avatar = '';

        if (author.visible()) {
          author.hide();
          if (this.bodyCell.select('strong').length === 0) {
            this.bodyCell.insert({top: '<strong style="color:#333;">'+author.textContent+'</strong><br>'});
            avatar = author.getAttribute('data-avatar') || 'http://asset1.37img.com/global/missing/avatar.png?r=3';
            author.insert({after: '<img alt="'+this.author()+'" width="32" height="32" align="top" style="opacity: 1.0; margin-left: 5px; border-radius:3px" src="'+avatar+'">'});
          }
        }
      }
    }
  });

  /* if you can wrap rather than rewrite, use swizzle like this: */
  swizzle(Campfire.Message, {
    setAuthorVisibilityInRelationTo: function($super, message) {
      $super(message);
      this.addAvatar();
    }
  });


  /* defining a new responder is probably the best way to insulate your hacks from Campfire and Propane */
  Campfire.AvatarMangler = Class.create({
    initialize: function(chat) {
      this.chat = chat;

      var messages = this.chat.transcript.messages;
      for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        message.addAvatar();
      }

      this.chat.layoutmanager.layout();
      this.chat.windowmanager.scrollToBottom();
    },

    onMessagesInserted: function(messages) {
      var scrolledToBottom = this.chat.windowmanager.isScrolledToBottom();

      for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        message.addAvatar();
      }

      if (scrolledToBottom) {
        this.chat.windowmanager.scrollToBottom();
      }
    }
  });

  /* Here is how to install your responder into the running chat */
  Campfire.Responders.push("AvatarMangler");
  window.chat.installPropaneResponder("AvatarMangler", "avatarmangler");
}

/*
  Display Gists inline.

  This responder illustrates using Propane's requestJSON service to request
  JSON from remote (non-authenticated) servers and have the results passed
  to a callback of your choosing.
*/

if (displayGists) {
  Campfire.GistExpander = Class.create({
    initialize: function(chat) {
      this.chat = chat;
      var messages = this.chat.transcript.messages;
      for (var i = 0; i < messages.length; i++) {
        this.detectGistURL(messages[i]);
      }
    },

    detectGistURL: function(message) {
      /* we are going to use the messageID to uniquely identify our requestJSON request
         so we don't check pending messages */
      if (!message.pending() && message.kind === 'text') {
        var links = message.bodyElement().select('a:not(image)');
        if (links.length != 1) return;
        var href = links[0].getAttribute('href');
        var match = href.match(/^https?:\/\/gist.github.com\/[A-Za-z0-9]+\/?$/);
        if (!match) return;
        var id = match[0].replace(/^https?:\/\/gist.github.com\/([A-Za-z0-9]+)\/?$/, '$1')
        window.propane.requestJSON(message.id(), 'https://api.github.com/gists/' + id, 'window.chat.gistexpander', 'onEmbedDataLoaded', 'onEmbedDataFailed');
      }
    },

    onEmbedDataLoaded: function(messageID, data) {
      var message = window.chat.transcript.getMessageById(messageID);
      if (!message) return;

      files = data['files']

      for (f in files) {
        var file = files[f];
        var content = file['content'].replace(/&/g,'&amp;').
                        replace(/>/g,'&gt;').
                        replace(/</g,'&lt;').
                        replace(/"/g,'&quot;');
        var display_lines = 10
        var link = file['raw_url'];
        var file_name = file['filename'];
        var end_id = "end_" + messageID
        var expander_id = "expand_" + messageID
        var continuation_id = "continue_" + messageID
        var content_lines = content.split("\n")
        var beginning = content_lines.slice(0,display_lines)
        var end = content_lines.slice(display_lines,content_lines.length)
        var continuation = "<div id='" + continuation_id + "' style='cursor:pointer;background:#ffff99;padding:5px'>+ Click to see more</div>"

        message.resize((function() {
          message.bodyCell.insert({bottom: '<div style="width:100%; margin-top:5px; padding-top: 5px; border-top:1px dotted #ccc;border-bottom:1px dotted #ccc;"><a href="' + link + '" target="_blank">' + file_name  + '</a><span id="' + expander_id + '" style="padding:5px;cursor:pointer;background:#ffff99;display:none">- Hide code</span>' + '<div><pre><code>' + beginning.join("\n") + '</code></pre></div>'+ continuation + '<div id="' + end_id + '" style="display:none"><pre><code>' + end.join("\n") + '</code></pre></div></div>'});

        function toggleExtended(){
            var expander = document.getElementById(expander_id)
            var end = document.getElementById(end_id)
            var cont = document.getElementById(continuation_id)
            if(end.style.display == "block"){
                end.style.display = expander.style.display = 'none';
                cont.style.display = "block";
            }
            else{
                end.style.display = expander.style.display = "block";
                cont.style.display = "none";
            }
        }

          document.getElementById(expander_id).onclick = document.getElementById(continuation_id).onclick = toggleExtended

        }).bind(this));
      }
    },

    onEmbedDataFailed: function(messageID) {
      /* No cleanup required, we only alter the HTML after we get back a succesful load from the data */
    },

    onMessagesInsertedBeforeDisplay: function(messages) {
      for (var i = 0; i < messages.length; i++) {
        this.detectGistURL(messages[i]);
      }
    },

    onMessageAccepted: function(message, messageID) {
      this.detectGistURL(message);
    }
  });

  Campfire.Responders.push("GistExpander");
  window.chat.installPropaneResponder("GistExpander", "gistexpander");
}