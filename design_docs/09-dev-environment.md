# Canvas Power Tools — 09: Development Environment

---

## Overview

This document covers everything needed to go from a blank Windows machine to
a fully configured development environment ready to build Canvas Power Tools.
Follow the steps in order — each step depends on the previous one.

---

## What You Are Installing

| Tool | Purpose |
|---|---|
| VS Code | Code editor |
| Node.js | JavaScript runtime — required to run build tools |
| Git | Version control |
| GitHub account | Remote code storage and collaboration |
| Chrome Developer Mode | Load and test unpacked extensions |
| Canvas Sandbox | Safe testing environment with real Canvas API |

All of these are free and open source except GitHub, which is free for public
repositories.

---

## Step 1 — VS Code

### Download and Install

```
1. Go to code.visualstudio.com
2. Click the big blue Download for Windows button
3. Run the installer once downloaded
4. Accept the license agreement
5. On the Select Additional Tasks screen
   check ALL of the following:

   [x] Add "Open with Code" to Windows Explorer file context menu
   [x] Add "Open with Code" to Windows Explorer directory context menu
   [x] Register Code as an editor for supported file types
   [x] Add to PATH (important — enables opening VS Code from terminal)

6. Click Next then Install then Finish
```

VS Code does not have workloads like Visual Studio does. Everything is added
through extensions instead. There is nothing to select during installation
beyond the checkboxes above.

### Install Extensions

```
1. Open VS Code
2. Click the Extensions icon in the left sidebar
   It looks like four squares with the top-right one slightly separated
   Or press Ctrl + Shift + X
3. A search box appears at the top of the panel
   labeled "Search Extensions in Marketplace"
4. Search and install each extension below
```

**ESLint**
```
Search:    ESLint
Publisher: Microsoft
Icon:      Purple circle with ES inside
```

**Prettier**
```
Search:    Prettier
Full name: Prettier - Code formatter
Publisher: Prettier
Icon:      Dark circle with a P
Note:      This is the VS Code extension — do NOT install via npm for this purpose
```

**React Snippets**
```
Search:    ES7 React
Full name: ES7+ React/Redux/React-Native snippets
Publisher: dsznajder
```

**Tailwind CSS IntelliSense**
```
Search:    Tailwind CSS
Full name: Tailwind CSS IntelliSense
Publisher: Tailwind Labs
Icon:      Teal Tailwind logo
```

**GitLens**
```
Search:    GitLens
Full name: GitLens — Git supercharged
Publisher: GitKraken
```

**JavaScript Debugger**
```
This is built into VS Code — no installation needed
If you search "Debugger for Chrome" it will show as deprecated
and point you to the built-in debugger, which is correct
```

### Configure Prettier as Default Formatter

```
1. Press Ctrl + Shift + P
2. Type: Preferences Open User Settings JSON
3. Press Enter
4. The settings.json file opens
5. Add these lines inside the outermost curly braces:

   "editor.defaultFormatter": "esbenp.prettier-vscode",
   "editor.formatOnSave": true

6. Save with Ctrl + S
```

Your code will now auto-format every time you save a file.

---

## Step 2 — Node.js

### Download and Install

```
1. Go to nodejs.org
2. You will see two download options
   LEFT button:  LTS (Long Term Support) — download this one
   RIGHT button: Current — do not download this

3. Run the installer
4. Click Next on the welcome screen
5. Accept the license agreement
6. Leave the destination folder as default
7. On the Custom Setup screen leave everything as default
8. On the Tools for Native Modules screen you will see:

   "Automatically install the necessary tools.
    Note that this will also install Chocolatey.
    The script will pop-up in a new window after installation."

   CHECK THIS BOX — these build tools are needed for some packages

9. Click Next then Install
10. Click Finish

11. A separate black PowerShell window will open automatically
    and install additional tools
    DO NOT close this window
    Press any key when it prompts you to
    This may take 5 to 15 minutes
    Let it complete fully
```

### Verify Installation

```
1. Press Windows key + R
2. Type powershell
3. Press Enter
4. Type each command and press Enter after each:

   node --version
   (should show something like: v20.x.x)

   npm --version
   (should show something like: 10.x.x)

If both show version numbers the installation was successful
If either says "command not recognized" reinstall Node.js
and make sure the installer completes fully
```

---

## Step 3 — Git

### Download and Install

```
1. Go to git-scm.com
2. Click Download for Windows
3. Run the installer
```

Git has many installer screens. Follow these carefully:

```
Screen 1 — License
  Click Next

Screen 2 — Installation Location
  Leave default, click Next

Screen 3 — Select Components
  Leave all defaults checked
  Ensure these are checked:
  [x] Git Bash Here
  [x] Git GUI Here
  [x] Associate .git files with default editor
  [x] Add a Git Bash Profile to Windows Terminal
  Click Next

Screen 4 — Default Editor
  Click the dropdown
  Select: Use Visual Studio Code as Git's default editor
  Click Next

Screen 5 — Initial Branch Name
  Select: Override the default branch name
  Type: main
  Click Next

Screen 6 — PATH Environment
  Select: Git from the command line and also from 3rd-party software
  (This is the recommended option in the middle)
  Click Next

Screen 7 — SSH Executable
  Leave default: Use bundled OpenSSH
  Click Next

Screen 8 — HTTPS Transport Backend
  Leave default: Use the OpenSSL library
  Click Next

Screen 9 — Line Ending Conversions
  Select: Checkout as-is, commit as-is
  Click Next

Screen 10 — Terminal Emulator
  Select: Use Windows' default console window
  Click Next

Screen 11 — Default Behavior of git pull
  Leave default: Default (fast-forward or merge)
  Click Next

Screen 12 — Credential Helper
  Leave default: Git Credential Manager
  Click Next

Screen 13 — Extra Options
  Leave defaults:
  [x] Enable file system caching
  [x] Enable symbolic links
  Click Next

Screen 14 — Experimental Options
  Leave both unchecked
  Click Install

Screen 15 — Complete
  Click Finish
```

### Configure Git Identity

```
1. Open PowerShell
2. Run these commands one at a time
   Replace with your actual name and email:

   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"

3. Verify:

   git --version
   (should show: git version 2.x.x.windows.x)
```

---

## Step 4 — GitHub Account

### Create Account

```
1. Go to github.com
2. Click Sign Up
3. Enter your email address
4. Create a password
5. Choose a username
   Make it something professional — it appears on your public repository
6. Complete the verification puzzle
7. Check your email and click the verification link
8. On the welcome survey click Skip personalization
```

### Connect Git to GitHub via SSH

SSH lets your computer push code to GitHub without entering a password every
time.

```
1. Open PowerShell
2. Generate an SSH key:

   ssh-keygen -t ed25519 -C "you@example.com"

   Replace with your GitHub email address

3. When asked where to save:
   Press Enter to accept the default location

4. When asked for a passphrase:
   Press Enter twice to skip (no passphrase)

5. Copy your public key to the clipboard:

   cat ~/.ssh/id_ed25519.pub | clip

6. Go to github.com
7. Click your profile picture (top right)
8. Click Settings
9. Click SSH and GPG keys in the left sidebar
10. Click New SSH key
11. Title: My Windows PC (or any label you choose)
12. Paste into the Key field with Ctrl + V
13. Click Add SSH key
    Enter your GitHub password if prompted

14. Verify the connection in PowerShell:

    ssh -T git@github.com

    Type: yes
    Press Enter when asked about authenticity

    You should see:
    Hi username! You have successfully authenticated.
```

---

## Step 5 — Chrome Developer Mode

```
1. Open Chrome
2. Go to: chrome://extensions
3. Find the Developer mode toggle in the top right corner
4. Toggle it ON
5. Three new buttons appear:
   Load unpacked | Pack extension | Update
6. Leave this tab open — you will use it when testing
```

Note: Chrome may show a small warning banner on startup saying you have
developer extensions loaded. This is normal and expected. Teachers who
install via the Chrome Web Store will not see this warning.

---

## Step 6 — Canvas Developer Sandbox

### Create Account

```
1. Go to canvas.instructure.com/register
2. Fill out the registration form with your real email
3. Click Register
4. Check your email and verify your account
5. Log in to your new Canvas account
6. You now have a free personal Canvas sandbox
```

### Create Test Data

```
1. Click Start a New Course
2. Name it: Test Course 101
3. Click Update Course Details to save
4. Click on the course to open it

5. Click Assignments in the left sidebar
6. Click + Assignment for each of the following:

   Assignment 1
   Name:   Quiz 1
   Points: 20
   Due:    One week from today
   Save

   Assignment 2
   Name:   Homework 1
   Points: 50
   Due:    Two weeks from today
   Save

   Assignment 3
   Name:   Midterm
   Points: 100
   Due:    Three weeks from today
   Save

   Assignment 4
   Name:   Quiz 2
   Points: 20
   Due:    Four weeks from today
   Save

   Assignment 5
   Name:   Final Project
   Points: 200
   Due:    Five weeks from today
   Save
```

### Generate API Token

```
1. Click your profile picture (top right of Canvas)
2. Click Settings
3. Scroll down to Approved Integrations
4. Click + New Access Token
5. Purpose: Canvas Power Tools Dev
6. Expiry: Leave blank for development purposes
7. Click Generate Token
8. COPY the token immediately
   Paste it into a text file on your desktop called token.txt
   Canvas will NEVER show this token again
   If you lose it you must generate a new one
```

### Test Your Token

```
1. Open a new Chrome tab
2. Paste the following URL
   Replace YOUR_TOKEN with the token you just copied:

   https://canvas.instructure.com/api/v1/courses?access_token=YOUR_TOKEN

3. Press Enter
4. You should see JSON data in the browser window
   It will look something like:
   [{"id":12345,"name":"Test Course 101",...}]

5. If you see data your sandbox and token are working correctly
6. If you see {"status":"unauthenticated"} the token was not copied correctly
```

---

## Step 7 — Build a Throwaway Extension

Before writing any code for Canvas Power Tools, build a simple throwaway
extension to get comfortable with how Chrome extensions work. This step is
not optional — it will save hours of confusion later.

### What You Are Building

A minimal extension that:
- Injects a button into the bottom right of any webpage
- Shows an alert when the injected button is clicked
- Has a popup when the extension icon is clicked in the Chrome toolbar

### Create the Project Folder

```
1. Create a folder on your Desktop named: hello-extension
2. Open VS Code
3. Click File > Open Folder
4. Select the hello-extension folder
```

### Create manifest.json

In VS Code, click the New File icon in the file explorer and create a file
named manifest.json. Paste this content:

```json
{
  "manifest_version": 3,
  "name": "Hello Extension",
  "version": "1.0",
  "description": "My first Chrome extension",
  "permissions": [
    "activeTab",
    "scripting"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Hello Extension"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ]
}
```

### Create popup.html

Create a new file named popup.html:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Hello Extension</title>
    <style>
      body {
        width: 220px;
        padding: 16px;
        font-family: sans-serif;
      }
      h3 {
        margin: 0 0 12px 0;
      }
      button {
        width: 100%;
        padding: 8px;
        cursor: pointer;
        background: #0770A2;
        color: white;
        border: none;
        border-radius: 4px;
      }
    </style>
  </head>
  <body>
    <h3>Hello Extension</h3>
    <button id="sayHello">Say Hello</button>
    <script src="popup.js"></script>
  </body>
</html>
```

### Create popup.js

Create a new file named popup.js:

```javascript
document.getElementById("sayHello").addEventListener("click", () => {
  alert("Hello from the popup!")
})
```

### Create content.js

Create a new file named content.js:

```javascript
// Create a button and inject it into the bottom right of the page
const button = document.createElement("button")
button.textContent = "Injected Button"
button.style.position = "fixed"
button.style.bottom = "20px"
button.style.right = "20px"
button.style.zIndex = "9999"
button.style.padding = "10px 16px"
button.style.background = "#0770A2"
button.style.color = "white"
button.style.border = "none"
button.style.borderRadius = "4px"
button.style.cursor = "pointer"
button.style.fontSize = "14px"

button.addEventListener("click", () => {
  alert("You clicked the injected button!")
})

document.body.appendChild(button)

// Log a message to the console to confirm the script ran
console.log("Canvas Power Tools content script is running on:", window.location.href)
```

### Load Into Chrome

```
1. Open Chrome
2. Go to chrome://extensions
3. Make sure Developer mode is ON (top right toggle)
4. Click Load unpacked
5. Select your hello-extension folder
6. The extension appears in the list with a green toggle
7. Open any webpage — you should see your injected blue button
   in the bottom right corner
8. Click the extensions puzzle piece icon in the Chrome toolbar
   Click Hello Extension
   The popup appears with the Say Hello button
```

### Experiments to Build Confidence

Try each of these modifications. After each one:
- Save the file in VS Code
- Go to chrome://extensions
- Click the refresh icon on your extension
- Reload the webpage to see the change

```
Experiment 1 — Change the button color
  In content.js change #0770A2 to any hex color
  e.g. button.style.background = "#E66000"

Experiment 2 — Change the button position
  Move it to the bottom left:
  button.style.left = "20px"
  Remove the right style line

Experiment 3 — Change the popup message
  In popup.html change the h3 text
  Change the button label text

Experiment 4 — Inject text instead of a button
  In content.js create a div instead:
  const div = document.createElement("div")
  div.textContent = "Hello from the extension"
  div.style.position = "fixed"
  div.style.top = "20px"
  div.style.right = "20px"
  div.style.background = "white"
  div.style.border = "1px solid #ccc"
  div.style.padding = "10px"
  div.style.zIndex = "9999"
  document.body.appendChild(div)

Experiment 5 — Open the browser console
  Press F12 on any webpage with the extension loaded
  Click the Console tab
  You should see the log message from content.js
```

Each experiment builds intuition for how content scripts, popups, and DOM
injection work — the exact skills needed to build Canvas Power Tools.

---

## Full Setup Checklist

```
VS CODE
[ ] Downloaded and installed
[ ] All four context menu checkboxes checked during install
[ ] Added to PATH during install
[ ] ESLint extension installed
[ ] Prettier extension installed
[ ] ES7+ React Snippets extension installed
[ ] Tailwind CSS IntelliSense extension installed
[ ] GitLens extension installed
[ ] Prettier set as default formatter in settings.json
[ ] Format on save enabled in settings.json

NODE.JS
[ ] LTS version downloaded (not Current)
[ ] Native build tools checkbox checked during install
[ ] Separate PowerShell tools window ran to completion
[ ] node --version returns a version number
[ ] npm --version returns a version number

GIT
[ ] Downloaded and installed
[ ] VS Code set as default editor during install
[ ] Initial branch set to main during install
[ ] Line endings set to checkout as-is, commit as-is
[ ] git --version returns a version number
[ ] Name configured: git config --global user.name
[ ] Email configured: git config --global user.email

GITHUB
[ ] Account created
[ ] Email verified
[ ] SSH key generated
[ ] Public key added to GitHub account
[ ] SSH connection verified: ssh -T git@github.com

CHROME
[ ] Developer mode enabled at chrome://extensions

CANVAS SANDBOX
[ ] Account created at canvas.instructure.com/register
[ ] Email verified and account confirmed
[ ] Test Course 101 created
[ ] Five test assignments created with due dates and points
[ ] API token generated and saved to token.txt on desktop
[ ] Token tested in browser — returns JSON course data

THROWAWAY EXTENSION
[ ] hello-extension folder created
[ ] manifest.json created
[ ] popup.html created
[ ] popup.js created
[ ] content.js created
[ ] Extension loaded in Chrome via Load unpacked
[ ] Injected button appears on webpages
[ ] Popup opens when clicking extension icon
[ ] Console message visible in browser dev tools
[ ] At least two experiments completed successfully
```

---

## Verify Everything Together

Open PowerShell and run all of these at once to confirm the full environment:

```
node --version
npm --version
git --version
code --version
```

All four must return version numbers without errors. If any say the command
is not recognized, that tool did not get added to PATH correctly during
installation and needs to be reinstalled.

---

## Next Step After This Checklist Is Complete

Once every box above is checked, return to the Canvas Power Tools project
and proceed to scaffolding the real project with Vite and CRXJS. That will
be the first session where actual Canvas Power Tools code is written.
