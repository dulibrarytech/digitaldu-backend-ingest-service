# Digital DU Backend Ingest Service - digitaldu

## Table of Contents

* [README](#readme)
* [Project Documentation](#project-documentation)
* [Releases](#releases)
* [Contact](#contact)

## README

### Background

The archival package ingest service for the University of Denver's Digital Collections repository, https://specialcollections.du.edu.

### Contributing

Check out our [contributing guidelines](/CONTRIBUTING.md) for ways to offer feedback and contribute.

### Licenses

[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

All other content is released under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).

### Local Environment Setup

```
Have MySql 5.5 - 5.7
Have ElasticSearch 7.10
cd into digitaldu-backend-ingest-service
npm install
Add .env file in root folder (see .env-example)
Import mysql schemas "repo" and "repo_queue" to db, schemas found in db folder.  Change extensions from .txt to .sql
run "node repo-ingest.js"
http://localhost:8001/repo/ingest
```

### Maintainers

@freyesdulib

## Project Documentation

* [v.1.0.0-beta pre release Repository Demo](https://youtu.be/1LGOQYEfz5I)

## Releases
* v0.8.0-beta [release]() [notes]()



## Contact

Ways to get in touch:

* Fernando Reyes (Developer at University of Denver) - fernando.reyes@du.edu
* Create an issue in this repository
