import fs from 'fs'
const cities = JSON.parse(fs.readFileSync('./node_modules/province-city-china/dist/city.json', 'utf8'))
const provinces = JSON.parse(fs.readFileSync('./node_modules/province-city-china/dist/province.json', 'utf8'))
console.log('Cities:', cities.slice(0, 3))
console.log('Provinces:', provinces.slice(0, 3))
