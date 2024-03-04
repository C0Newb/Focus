FROM cnewb/node:18-nanoserver-1809

ADD . /Focus/
WORKDIR /Focus/Src/

EXPOSE 8080
ENTRYPOINT [ "node", "C:/Focus/src/index.js" ]