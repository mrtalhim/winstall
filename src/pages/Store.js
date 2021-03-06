import React, { useState, useEffect } from "react";
import styles from "../styles/store.module.scss";

import { useIndexedDB } from "react-indexed-db";
import { DebounceInput } from "react-debounce-input";
import fuzzysort from "fuzzysort"

import SelectionBar from "../components/SelectionBar";

import SingleApp from "../components/SingleApp";
import processManifests from "../utils/processManifests";
import { sortArray, sanitize } from "../utils/helpers";
import Footer from "../components/Footer";

import PropagateLoader from "react-spinners/PropagateLoader";

import { FiRotateCcw, FiInfo } from "react-icons/fi";

function Store() {
    let localData = useIndexedDB("packages")
    const [apps, setApps] = useState([])
    const [searchInput, setSearchInput] = useState();
    const [totalApps, setTotalApps] = useState([])
    const [loading, setLoading] = useState(true);
    const [appCount, setAppCount] = useState(0);
    
    useEffect(() => {
      getApps();

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getApps = () => {
        localData.getAll().then(async (items) => {
            setAppCount(items.length)

            if(items.length === 0 ){
                getApps();
                return;
            }

            items.map((i) => {
                if(!i.loaded){ // if it already doesn't have a laoded value, we set it to false
                    i.loaded = false;
                }

                // if there is content, that means we have it in cache
                if (i.contents !== ""){
                    i.loaded = true;
                }

                i.loading = false;

                return i;
            });

            // we put the items that are loaded first, and then by alphabetical order
            items.sort((a, b) => ((a.loaded === b.loaded) ? 0 : a.loaded ? -1 : 1) || (a.path.split("/")[1].localeCompare(b.path.split("/")[1])))

            setApps(items);
            setTotalApps(items);
            setLoading(false);
        })
    }

    const handleSearchInput = (e) => {
        setSearchInput(e.target.value);

        if(e.target.value === ""){
            getApps();
            return;
        }

        let results = fuzzysort.go(e.target.value.toLowerCase().replace(/\s/g, ""), apps, {
            limit: Infinity,
            allowTypo: true,
            threshold: -10000,
            key: "path",
        })

        results = [...results.map(r => r.obj)];

        results.sort((a, b) => a.path.localeCompare(b.path))
        
        setApps(results)
    };

    const selectivePull = (obj) => {
        let app = totalApps.find((i) => i.path === obj.path);

        if (!app.contents) {
            processManifests(obj).then((newData) => {
                app.contents = newData;
                localData.update({ ...obj, contents: newData }, obj.path);
                app.loaded = true;
                app.loading = false;
                setTotalApps((oldArray) => sortArray([...oldArray, app]));
            });
        }  else{
            app.loaded = true;
            app.loading = false;
            setTotalApps((oldArray) => sortArray([...oldArray, app]));
        }
    }

    const clearCache = () => {
      if(window.confirm("Are you sure you want to clear the local cache and reload all app data?")){
        setLoading(true);
        localData.clear().then(() => window.location.reload());
      }
    }

    let LoadApp = ({ app }) => {
        const [loading, setLoading] = useState(false);


        return (
          <li
            className={styles.notReady}
            onClick={() => {
              setLoading(true);
              selectivePull(app);
            }}
          >
            <h3>{app.path.split("/")[1]}</h3>
            <h4>{app.path.split("/")[0]}</h4>
            <button
              className="subtle"
              disabled={loading}
            
            >
              <FiInfo/>{loading ? "Loading..." : "Click to view"}
            </button>
          </li>
        );
    }
    if(!apps) return <></>;

    return (
      <div className="container">
        <h1>All Apps {`(${appCount})`}</h1>
        <h3>
          You can browse all the apps available on the Windows Package Manager below. Click an app to view more details about it.
        </h3>

        <div className={styles.controls}>
          <DebounceInput
            minLength={2}
            debounceTimeout={100}
            onChange={(e) => handleSearchInput(e)}
            value={searchInput}
            placeholder="Search for apps here"
            className="search"
          />
          <button className={styles.btn} onClick={clearCache}><FiRotateCcw/>Clear cache</button>
        </div>

        {loading ? (
          <div className={styles.loader}>
            <PropagateLoader color="#9b2eff" />
          </div>
        ) : (
          <ul className={styles.all}>
            {apps.map((app) =>
              app.loaded ? (
                <SingleApp app={sanitize(app)} key={app.contents.Id} />
              ) : (
                <LoadApp app={app} key={app.path} />
              )
            )}
          </ul>
        )}

        <Footer />
        <SelectionBar />
      </div>
    );
}

export default Store;
