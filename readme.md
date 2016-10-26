This project runs most of its tasks through Gulp.

The package.json has an NPM script that packages Gulp locally.

Run the following command to spin up a self-signed https localhost with browsersync.

```
npm install
npm run gulp watch
```

You might also need to upgrade your version of node to the latest either manually or by using NVM.

---

CURRENTLY THE LEGACY NATIONBUILDER CSS IS STILL USING RUBY

To re-compile legacy nationbuilder css run following commands from root.


```
cd nationbuilder
gem install bundler
bundler install
bundle exec compass compile
```
