FROM node:slim

WORKDIR /usr/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000 80 

CMD ["npm", "run", "dev"]

