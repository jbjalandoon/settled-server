FROM node:slim

workdir /usr/app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "run", "dev"]

