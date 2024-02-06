# Web Broadcast Assistant

If you haven't done it yet, first go to [The Zephyr getting started guide](https://docs.zephyrproject.org/latest/develop/getting_started/index.html) and install all dependencies (I'd recommend following the path with the virtual python environment).

# For development
For developers of the application, first do a fork of the repo.  Then do the following:

Make a local workspace folder (to hold the repo, zephyr and west modules):

```
mkdir my-workspace
cd my-workspace
```

Clone the repo:

```
git clone git@github.com:<your handle>/web-broadcast-assistant.git
```

Initialize west and update dependencies:

```
west init -l web-broadcast-assistant
west update
```

# For normal use (non-development)
This repo contains a stand alone Zephyr application that can be fetched and initialized like this:

```shell
west init -m https://github.com/larsgk/web-broadcast-assistant --mr main my-workspace
```

Then use west to fetch dependencies:

```shell
cd my-workspace
west update
```

# Build and flash

Go to the repo folder:

```
cd web-broadcast-assistant
```

Run:

```
west build -b <target board id> app --pristine
```

Flash:

```
west flash
```
