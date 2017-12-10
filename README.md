# Lock And Key - a web concierge for your apartments main entrance
![Alt text](http://i.imgur.com/cjBl3mX.jpg "") ![Alt text](http://i.imgur.com/BqK13Bo.jpg "")

## About
A simplified approach from the originial Lock And Key. This branch has a single endpoint which answers the phone when the correct token is provided.

```bash
http://exmaple.com/login?token=xxxxxxxxxx"
```

![Alt text](http://i.imgur.com/eVtwtzu.jpg "")

## Hardware
1. Raspberry Pi Model B
2. TFM-561U

## Config file
lockandkeyconfig.json contains a few options you can customize to your liking: 
* **port:** port used for the publicaly available login portal
* **unlocktimeout:** number of minutes to wait after a succesful login. During this window the system will pickup, dial 6, and hangup. 
* **modem_id:** string used to identify the modem which should be used by the application 
* **secret_token:** The token you provide in the GET request to unlock the door 
```json
{
  "port":3000,
  "unlocktimeout":15,
  "modem_id":"Conexant"
  "secrent_token": "XXXXXXXXXX"
}
```

## Installation
```
sudo apt-get update
sudo apt-get install git npm nodejs mongodb
sudo ln -s /usr/bin/nodejs /usr/bin/node

git clone https://github.com/raudette/lockandkey.git
cd lockandkey/

npm install
```

### Running as a service
```
sudo npm install -g forever
sudo npm install -g forever-service
sudo forever-service install lockandkey --script lockandkey.js
sudo service lockandkey start
```

Logs will write to `/var/log/lockandkey.log`

## TODO
- [ ] Setup Lets Encrypt for SSL
- [ ] Text-To-Speach greeting

## Credit
Original codebase: [raudette/lockandkey](https://github.com/raudette/lockandkey)  
