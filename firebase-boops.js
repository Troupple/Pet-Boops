const BoopsSync = (() => {
  let petsData = [];
  let listeners = [];
  let syncEnabled = false;

  function waitForFirebase() {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timeout = 5000;
      
      const checkFirebase = () => {
        if (window.firebaseDB && window.firebaseInitialized) {
          syncEnabled = true;
          resolve();
        } else if (Date.now() - startTime < timeout) {
          setTimeout(checkFirebase, 100);
        } else {
          resolve();
        }
      };
      checkFirebase();
    });
  }

  function onUpdate(callback) {
    listeners.push(callback);
  }

  function notifyListeners() {
    listeners.forEach(cb => {
      try {
        cb(petsData);
      } catch (e) {
        console.error("Error in boop listener:", e);
      }
    });
  }

  async function initializeSync(petNames) {
    await waitForFirebase();

    if (!syncEnabled || !window.firebaseDB) {
      return;
    }
    
    petNames.forEach((petName) => {
      const petRef = window.firebaseDB.ref(`pets/${petName}`);

      petRef.on("value", (snapshot) => {
        const data = snapshot.val();
        if (data) {
          updateLocalPetData(petName, data);
        }
      });
    });
  }

  function updateLocalPetData(petName, firebaseData) {
    const petIndex = petsData.findIndex(p => p.name === petName);
    if (petIndex !== -1) {
      petsData[petIndex].boops = firebaseData.boops || 0;
      notifyListeners();
    }
  }

  async function recordBoop(petName) {
    if (!syncEnabled || !window.firebaseDB) {
      return false;
    }

    try {
      const petRef = window.firebaseDB.ref(`pets/${petName}`);

      await petRef.update({
        boops: firebase.database.ServerValue.increment(1),
        lastUpdated: firebase.database.ServerValue.TIMESTAMP
      });

      return true;
    } catch (error) {
      console.error(`Error recording boop for ${petName}:`, error);
      return false;
    }
  }

  function getTotalBoops() {
    return petsData.reduce((sum, pet) => sum + (pet.boops || 0), 0);
  }

  function getPet(petName) {
    return petsData.find(p => p.name === petName);
  }

  function setLocalPetData(pets) {
    petsData = pets;
  }

  function getAllPets() {
    return petsData;
  }

  async function initializeDatabase(pets) {
    if (!syncEnabled || !window.firebaseDB) {
      return;
    }

    try {
      for (const pet of pets) {
        const petRef = window.firebaseDB.ref(`pets/${pet.name}`);
        const snapshot = await petRef.once("value");
        
        if (!snapshot.exists()) {
          await petRef.set({
            boops: 0,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
          });
        } else {
          const data = snapshot.val();
          const petIndex = petsData.findIndex(p => p.name === pet.name);
          if (petIndex !== -1) {
            petsData[petIndex].boops = data.boops || 0;
          }
        }
      }
      notifyListeners();
    } catch (error) {
    }
  }

  function disconnect() {
    if (window.firebaseDB) {
      window.firebaseDB.ref("pets").off();
    }
  }

  return {
    initializeSync,
    recordBoop,
    onUpdate,
    getTotalBoops,
    getPet,
    getAllPets,
    setLocalPetData,
    initializeDatabase,
    disconnect,
    waitForFirebase
  };
})();

window.BoopsSync = BoopsSync;
