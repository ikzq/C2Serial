// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.plugins_, "cr.plugins_ not created");

/////////////////////////////////////
// Plugin class        
cr.plugins_.NWSerial = function(runtime)
{
	this.runtime = runtime;
};

(function ()
{
	var pluginProto = cr.plugins_.NWSerial.prototype;
		
	/////////////////////////////////////
	// Object type class
	pluginProto.Type = function(plugin)
	{
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};

	var typeProto = pluginProto.Type.prototype;

	// called on startup for each object type
	typeProto.onCreate = function()
	{
	};

	/////////////////////////////////////
	// Instance class
	pluginProto.Instance = function(type)
	{
		this.type = type;
		this.runtime = type.runtime;
	};
	
	var instanceProto = pluginProto.Instance.prototype;
	
	var isSupported = (typeof chrome.serial !== "undefined");
	
	var last_serialPort = "";
	
	var connectionID = null;
	
	var stringReceived = '';

	// called whenever an instance is created
	instanceProto.onCreate = function()
	{
		this.messageText = "";
		this.errorMsg = "";
		this.closeCode = 0;
		this.closeReason = "";
	};

	instanceProto.saveToJSON = function ()
	{
		return { "messageText": this.messageText, "errorMsg": this.errorMsg };
	};
	
	instanceProto.loadFromJSON = function (o)
	{
		this.messageText = o["messageText"];
		this.errorMsg = o["errorMsg"];
	};
	
	/**BEGIN-PREVIEWONLY**/
	instanceProto.getDebuggerValues = function (propsections)
	{
		propsections.push({
			"title": "SerialPort",
			"properties": [
				{"name": "Serial Port", "value": last_serialPort, "readonly": true},
				{"name": "connectionID", "value": connectionID, "readonly": true},
				{"name": "Last error", "value": this.errorMsg, "readonly": true},
				{"name": "Last message", "value": this.messageText, "readonly": true}
			]
		});
	};
	/**END-PREVIEWONLY**/

	//////////////////////////////////////
	// Conditions
	function Cnds() {};

	Cnds.prototype.OnOpened = function ()
	{
		return true;
	};
	
	Cnds.prototype.OnClosed = function ()
	{
		return true;
	};
	
	Cnds.prototype.OnError = function ()
	{
		return true;
	};
	
	Cnds.prototype.OnMessage = function ()
	{
		return true;
	};
	
	Cnds.prototype.IsOpen = function ()
	{
		return connectionID;
	};
	
	Cnds.prototype.IsSupported = function ()
	{
		return isSupported;
	};
	
	pluginProto.cnds = new Cnds();
	
	//////////////////////////////////////
	// Actions
	function Acts() {};

	Acts.prototype.Connect = function (comPort_, baudRate_)
	{
		if (!isSupported)
			return;
		
		// Close existing connection if any
		if (connectionID) {
			self.errorMsg = "Already Connected to a port.";
			self.runtime.trigger(cr.plugins_.NWSerial.prototype.cnds.OnError, self);
		}
			
		var self = this;
		
		last_serialPort = comPort_;
		
		try {
			if (baudRate_ === "") {
				baudRate_ = 9600;
			}
			chrome.serial.connect(comPort_, {bitrate: baudRate_}, function(CI) {
				if(CI){
					console.log("Serial Port "+comPort_+" Connected ");
					connectionID = CI.connectionId;
					console.log("Serial Port Connection ID: "+connectionID);
					self.runtime.trigger(cr.plugins_.NWSerial.prototype.cnds.OnOpened, self);
				} else {
					self.errorMsg = "Unable to create a Serial Port with the given port and baud rate.";
					self.runtime.trigger(cr.plugins_.NWSerial.prototype.cnds.OnError, self);
				}
				
			});
		}
		catch (e) {
			self.errorMsg = "Unable to create a Serial Port with the given port and baud rate.";
			self.runtime.trigger(cr.plugins_.NWSerial.prototype.cnds.OnError, self);
			return;
		}
		
		chrome.serial.onReceive.addListener(function(info) {
			if (info.connectionId == connectionID && info.data) {
				var bufView = new Uint8Array(info.data);
				var encodedString = String.fromCharCode.apply(null, bufView);
				var str = decodeURIComponent(encodedString);
				
				if (str.charAt(str.length-1) === '\n') {
					stringReceived += str.substring(0, str.length-1);
					self.messageText = stringReceived || "";
					self.runtime.trigger(cr.plugins_.NWSerial.prototype.cnds.OnMessage, self);
					stringReceived = '';
				} else {
					stringReceived += str;
				}
				
			}
		});
	};
	
	Acts.prototype.Close = function ()
	{
		if (connectionID){
			chrome.serial.disconnect(connectionID, function(result) {
				self.closeCode = 0;
				self.closeReason = "Self Disconnect";
				self.runtime.trigger(cr.plugins_.NWSerial.prototype.cnds.OnClosed, self);
			});
			connectionID=null;
		}
	};
	
	Acts.prototype.Send = function (msg_)
	{
		if (!connectionID)
			return;
		
		var buf=new ArrayBuffer(msg_.length);
		var bufView=new Uint8Array(buf);
		for (var i=0; i<msg_.length; i++) {
			bufView[i]=msg_.charCodeAt(i);
		}
		chrome.serial.send(connectionID, buf, function(str){
			
		});
		chrome.serial.getInfo(connectionID, function(connectionInfo){
			if(typeof connectionInfo.bitrate !== "undefined"){
				self.closeReason = "Device Disconnected";
				self.runtime.trigger(cr.plugins_.NWSerial.prototype.cnds.OnClosed, self);
				connectionID=null;
			}
		});
		
	};
	
	pluginProto.acts = new Acts();
	
	//////////////////////////////////////
	// Expressions
	function Exps() {};
	
	Exps.prototype.MessageText = function (ret)
	{
		ret.set_string(this.messageText);
	};
	
	Exps.prototype.ErrorMsg = function (ret)
	{
		ret.set_string(cr.is_string(this.errorMsg) ? this.errorMsg : "");
	};	
	
	Exps.prototype.CloseCode = function (ret)
	{
		ret.set_int(this.closeCode);
	};
	
	Exps.prototype.CloseReason = function (ret)
	{
		ret.set_string(this.closeReason);
	};
	
	pluginProto.exps = new Exps();

}());