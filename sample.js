const myFunction = new Promise((resolve, reject) => {
    
    users.where("username", "==", req.body.username).get().then((results) => {
        resolve(results);
    })
});

// check of username exists
const check_username_exists = async () => {
    var name_results = await users.where("username", "==", req.body.username).get();

    if (name_results.empty && name_results.docs.length == 0) {
      return null;
    } else {
      return name_results.docs;
    }
  };


myFunction.then()