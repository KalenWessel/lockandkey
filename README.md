# Lock And Key - automated doorman 
![Alt text](http://i.imgur.com/cjBl3mX.jpg "") ![Alt text](http://i.imgur.com/BqK13Bo.jpg "")

## About
Originally forked from [raudette/lockandkey](https://github.com/raudette/lockandkey) This project was created to solve a technoligical shortcoming in my current apartment. At least in my building the buzzer system is only designed to ring phones directly connected to a phonejack in the unit. This isn't ideal since I may not always be home when I want to let someone into my building.

## How does it work?
A Raspberry Pi runs a nodejs application backed by a mongo databases for persistent data. The TFM-561U USB modem (56k dial up sounds anyone?) handles passing the call along to the Raspberry Pi so we can determine what we want to do with it. If a guest has the necessary login credentials they can visit my login portal. On successful authentication the user is redirected to a page which tells them they have **_xx_** number of minutes to buzz in before the system will lock them out again. The admin is also sent an email letting them know which user has just logged in.

When the app notices a succesful login it handles a few things:
1. Sets the usesrs `LOCK` flag to `False`
2. Updates the users last successful login `timestamp`
3. Sets the `auto-answer` flag to `True`

Now when the guest dials my unit number the application will answer the call, dial 6, and hang up the call. The main entrance door will be unlocked and my guest can enter the building. A check runs every 10 seconds looking for users who have their `LOCK` flag set to `False` and `current time` is not greater than the `login time + unlocktimeout`. 

## Admin Portal
![Alt text](http://i.imgur.com/x8gUg9T.jpg "") 

The admin portal listens on a seperate port and should **ONLY** be accessible from your private LAN. It allows you to add new users as well as delete exisiting ones. 


## Hardware
1. Raspberry Pi Model B
2. TFM-561U

## Config file
lockandkeyconfig.json contains a few options you can customize to your liking: 
* **port:** port used for the publicaly available login portal
* **adminport:** port used for the admin portal (should be restricted to private lan)
* **unlocktimeout:** number of minutes to wait after a succesful login. During this window the system will pickup, dial 6, and hangup. 
* **modem_id:** string used to identify the modem which should be used by the application 
* **sendgridkey:** Send Grid API key used for sending emails on succesful logins
* **emailto:** Address which emails will be sent to.
* **emailfrom:** You can essentially put whatever you want here. I'm using no-reploy@mydomain.
```json
{
  "port":3000,
  "adminport":3001,
  "unlocktimeout":15,
  "modem_id":"Conexant"
  "sendgridkey": "<API_KEY>",
  "emailto": "youremail@example.com",
  "emailfrom": "no-reply@example.com"
}
```

## Setup
1. Update OS 
2. Install mongo db
3. Clone git repo
4. npm install


## TODO
- [ ] Setup Lets Encrypt for SSL

## Credit
Original codebase: [raudette/lockandkey](https://github.com/raudette/lockandkey)  
Login form design: [vineethtr](http://codepen.io/vineethtr/pen/LAEyw)




