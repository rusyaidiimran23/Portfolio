"""Static portfolio content + the private garage log.

Edit these dicts to update your site. The public content is served at
/api/content; the garage data is served at /api/garage only with a valid token.
"""

# ---- PUBLIC CONTENT (homepage) --------------------------------------------

CONTENT = {
    "hero": {
        "name": "Rusyaidi Yeng",
        "tagline": "I build IoT systems end to end — from sensors and dataloggers in the "
                   "field to installation, data and dashboards.",
        "rpm": 15000,  # ZX-4RR redline vibe, drives the tachometer accent
    },
    # DRAFTED from your project docs — review wording, roles and client names
    # before publishing (some clients may not want to be named publicly).
    "about": (
        "I build environmental-monitoring systems end to end — out in the field "
        "with tripods, dataloggers and sensors, and back at the desk with the "
        "APIs, dashboards and alerts that turn readings into decisions. Weather, "
        "air quality, soil, AI cameras: if it measures something, I've "
        "probably wired it, coded it, or both. Outside of work, I'm usually at "
        "a track day or out on some twisty roads."
    ),
    "skills": [
        "Python / FastAPI", "PostgreSQL / SQLAlchemy", "Astro", "TypeScript / JS",
        "LoRaWAN / SenseCAP", "MQTT", "Dataloggers & met sensors", "Field install & commissioning",
        "YOLOv8 / Jetson", "Leaflet / Maps", "Linux",
    ],
    # Each project powers a case study AND a screen on the hero LED billboard.
    #   scene:   pixel-art on the board — building | palm | signal | station |
    #            bolt | camera | cocoa | track
    #   photos:  NOT here — drop them in P.Portfolio/photos/<id>/ and run
    #            .\update-photos.ps1 (file name = caption, number = order)
    #   status:  optional badge on the case study, e.g. "Proposal · under consideration"
    #   tag:     <= 7 characters (big LED letters)
    #   lat/lon: deployment site, pinned on the hero map (omit = nationwide)
    #   marquee: scrolls along the board; LED font has A-Z 0-9 and - . / : + & % , ! * @
    "projects": [
        {
            "id": "trx", "lat": 3.142, "lon": 101.719, "tag": "TRX", "scene": "building", "color": "#00d2be",
            "status": "Live · 2 more stations coming",
            "title": "Air-Quality Monitoring Network",
            "client": "TRX City", "location": "Tun Razak Exchange, Kuala Lumpur",
            "year": "2026", "category": "Field install", "role": "Project engineering & installation",
            "summary": "Air-quality monitoring for Kuala Lumpur's new financial district, built on "
                       "Kunak Air Pro stations. I took it from proposal to installation on site, "
                       "and the network is growing: two more stations are coming at the Apple Park.",
            "highlights": [
                "Wrote the technical proposal and method statement for the Kunak Air Pro deployment",
                "Produced the installation drawings for the MRT Plaza and Raintree Plaza sites",
                "Ran factory acceptance testing (QA/QC) and the HIRARC risk assessment",
                "Managed the programme on a Gantt schedule and installed the stations on site",
                "Expansion underway: two more stations planned at the Apple Park",
            ],
            "stack": ["Kunak Air Pro", "Air quality", "FAT / QA-QC", "HIRARC", "Site drawings"],
            "marquee": "AIR QUALITY MONITORING * KUNAK AIR PRO * TRX KUALA LUMPUR * 2 MORE STATIONS COMING",
        },
        {
            "id": "mpob", "lat": 5.031, "lon": 118.327, "tag": "MPOB", "scene": "palm", "color": "#ffb000",
            "title": "Evapotranspiration Monitoring Station",
            "client": "Malaysian Palm Oil Board", "location": "Lahad Datu, Sabah",
            "year": "2026", "category": "Field install", "role": "Project management, logger programming & installation",
            "summary": "An evapotranspiration (ET) station at MPOB's palm-oil research site in Sabah, "
                       "collecting continuous meteorological data. I managed the project, programmed "
                       "the logger, and installed and commissioned the station.",
            "highlights": [
                "Managed the project end to end, coordinating MPOB, suppliers and the site team",
                "Programmed the Campbell Scientific CR350 datalogger for the station's measurements",
                "Erected a 3 m tripod with air temperature/RH, wind speed & direction, solar radiation and rain sensors",
                "Wired power, earthing and lightning protection, then commissioned, trained the site team and reported",
            ],
            "stack": ["Campbell CR350", "CRBasic", "Met sensors", "Solar power", "Lightning protection"],
            "marquee": "EVAPOTRANSPIRATION STATION * LAHAD DATU, SABAH * MPOB",
        },
        {
            "id": "stars", "tag": "STARS", "scene": "signal", "color": "#39ff6a",
            "title": "STARS — Telemetry, Alerts & Reporting",
            "client": "Surechem", "location": "Multi-site, Malaysia",
            "year": "2026", "category": "Platform", "role": "Initiator & full-stack developer",
            "summary": "My own initiative: one platform that takes in data from many different "
                       "loggers and sources, so every station, whatever brand or link it uses, "
                       "ends up on the same map, dashboards and alerts.",
            "highlights": [
                "Started and built on my own initiative to replace one-off dashboards per project",
                "Ingests data from multiple, different loggers and sources, including the SenseCAP cloud API for LoRaWAN weather and soil nodes",
                "Designed a logger-agnostic PostgreSQL schema: clients, sites, stations, loggers, sensors, time series",
                "Dashboard with a station map, live status cards and data tables",
            ],
            "stack": ["Python", "FastAPI", "PostgreSQL", "SQLAlchemy", "Astro", "LoRaWAN"],
            "marquee": "STARS * MANY LOGGERS + SOURCES * ONE PLATFORM * TELEMETRY, ALERTS & REPORTING",
        },
        {
            "id": "rht", "lat": 5.696, "lon": 101.003, "tag": "RHT", "scene": "station", "color": "#3fa9ff",
            "title": "Mine Weather Station Portal",
            "client": "Rahman Hydraulic Tin", "location": "Pengkalan Hulu, Perak",
            "year": "2026", "category": "Platform", "role": "End-to-end delivery",
            "summary": "Two rain gauges and a GMX500 weather station at an open-pit tin mine, "
                       "delivered end to end: from project management and logger configuration "
                       "to the live portal, installation and handover.",
            "highlights": [
                "Managed the project from start to handover",
                "Configured the Bivocom loggers to push hourly CSVs over FTP, ingested with de-duplication",
                "Built the portal: network KPIs and site map, per-station charts, wind rose, rainfall reports, AI briefings and exports",
                "Installed the stations on site and ran testing, commissioning & training (TCT)",
            ],
            "stack": ["Bivocom", "FastAPI", "PostgreSQL", "SQLAlchemy", "Leaflet", "Vanilla JS"],
            "marquee": "RAIN + WEATHER STATIONS * PENGKALAN HULU, PERAK * END TO END: LOGGERS, PORTAL, INSTALL",
        },
        {
            "id": "surecam", "tag": "SURECAM", "scene": "camera", "color": "#ff2bd6",
            "title": "SureCam AI — Smart CCTV & Attendance",
            "client": "Surechem", "location": "Malaysia",
            "year": "", "category": "AI / Vision", "role": "Initiator & computer-vision developer",
            "summary": "My own initiative: turning ordinary CCTV into a smart camera. Edge AI on "
                       "NVIDIA Jetson flags fights and weapons for residential and school "
                       "monitoring, and a computer-vision attendance tracker logs who is on site.",
            "highlights": [
                "Started on my own initiative and built from the ground up",
                "YOLOv8 pose + object detection for fight and knife detection",
                "Attendance tracking with computer vision, straight from the camera feed",
                "Roughly 2x faster inference on Jetson with FP16, layer fusion and frame skipping, streamed live to a dashboard",
            ],
            "stack": ["Python", "YOLOv8", "NVIDIA Jetson", "OpenCV"],
            "marquee": "AI CCTV * FIGHT + WEAPON DETECTION * CV ATTENDANCE TRACKING * EDGE AI ON JETSON",
        },
        {
            "id": "lkm", "tag": "LKM", "scene": "cocoa", "color": "#ff7a1a",
            "title": "Digital Farm Operation & Management",
            "client": "Lembaga Koko Malaysia", "location": "Malaysia",
            "year": "2025", "category": "Platform", "role": "System delivery",
            "summary": "A digital operations system for cocoa farms: harvest yields, tree "
                       "allocation and IoT soil monitoring in one place.",
            "highlights": [
                "Delivered from requirements and system design through to FAT and installation",
                "Migrated historical harvest-yield records per block into the new database",
                "Tree allocation, user management and a redesigned tree map, plus IoT soil monitoring",
            ],
            "stack": ["Database design", "Data migration", "IoT soil sensors", "FAT"],
            "marquee": "COCOA FARM MANAGEMENT * YIELD RECORDS * IOT SOIL MONITORING",
        },
        {
            "id": "sic", "lat": 2.7606, "lon": 101.7381,
            "tag": "SIC", "scene": "track", "color": "#ff2a1a",
            "status": "POC built · SIC considering",
            "title": "Asphalt Track Monitoring",
            "client": "Sepang International Circuit", "location": "Sepang, Selangor",
            "year": "", "category": "Proposal", "role": "Initiator, proposal & proof of concept",
            "summary": "My own idea, shaped by how race tracks actually run: monitor the asphalt "
                       "itself alongside air quality and weather, and forecast track conditions. "
                       "I wrote the proposal and built a proof of concept, and Sepang is "
                       "seriously considering it.",
            "highlights": [
                "Initiated the idea and wrote the technical proposal, based on my understanding of race-track operations",
                "Built a proof of concept to show it working",
                "Track-surface (asphalt) monitoring alongside air quality and on-site weather, with forecasting",
                "Under serious consideration by Sepang International Circuit",
            ],
            "stack": ["Asphalt monitoring", "Air quality", "Weather", "Forecasting", "Proof of concept"],
            "marquee": "SEPANG INTERNATIONAL CIRCUIT * ASPHALT TRACK MONITORING * PROPOSAL + POC * UNDER SERIOUS CONSIDERATION",
        },
    ],
    "social": {
        "github": "https://github.com/",
        "email": "dubstepadiyeng@gmail.com",
    },
}

# ---- PRIVATE GARAGE (behind password) -------------------------------------

GARAGE = {
    "builds": [
        {
            # id = photo folder P.Portfolio/photos/<id>/ ; scene = LED board art if no photos
            "id": "cefiro", "tag": "CEFIRO", "color": "#ff1e2d", "scene": "car",
            "name": "Nissan Cefiro",
            "chassis": "A31", "year": "1993",
            # estimated from a 0-100 km/h of 6.0 s at ~1,360 kg (an RB20DET A31 does
            # 6.8 s on 205 PS; an R33 RB25DET on 245 PS runs low 6s). Swap in dyno figures when you have them.
            "hp": 240, "torque_nm": 300, "weight_kg": 1360, "estimate": True,
            "torque": "~300 Nm (est.)",
            "review": {"body": ["To be added."]},
            "status": "In progress",
            "power": "~240 hp (est. · 0-100 in 6.0 s)",
            "log": [
                {"date": "2026-06-02", "note": "Baseline compression test — all cylinders healthy."},
                {"date": "2026-06-20", "note": "New coilovers on order. Planning a fresh set of wheels."},
                {"date": "2026-07-10", "note": "Sourcing an intercooler for the RB swap."},
            ],
        },
        {
            "id": "zx4rr", "tag": "ZX-4RR", "color": "#7cff2e", "scene": "bike",
            "name": "Kawasaki ZX-4RR",
            "chassis": "", "year": "2026",
            "status": "Running",
            "hp": 76, "torque_nm": 37.6, "weight_kg": 188,
            "power": "76 hp @ 14,500 rpm",
            "torque": "37.6 Nm @ 12,500 rpm",
            "review": {
                "title": "1 month / 1,000 km review",
                "body": [
                    "Honestly was contemplating hard to upgrade to a bigger bike, but the ZX-4RR has been the perfect tool to scratch that itch. The 188 kg weight of the bike is still nimble enough to carve the canyon (read: BTIC) like a scalpel, but at the same time has enough power to zoom through Karak Highway, given that your left foot is not lazy to dance up and down the shifter.",
                    "What got me by the balls was definitely the high-pitch orgasmic scream of the relatively small I-4 engine that redlines at 16k rpm. Amplified by a super illegal, super fake, Shopee-financed Austin Racing rep exhaust, this thing makes people stop & stare whenever you do a flyby (not exaggerating, but the F1-wannabe sound of the bike truly is beautiful).",
                    "Fuel efficiency sucks balls in this economy tho. The bike drinks fuel like it's got a personal grudge against my wallet. But hey, it's a sports bike, can't complain much.",
                    "Overall, good bike and a good upgrade from a 250cc. I know no one is gonna read this, just keeping it for my own personal records."
                ]
            },
            "log": [
                {"date": "2026-05-15", "note": "First track day — dialed in suspension sag."},
                {"date": "2026-06-28", "note": "Fitted a quickshifter. Fueling map next."},
                {"date": "2026-07-14", "note": "Fresh tyres, chain, and brake pads for summer season."},
            ],
        },
        {
            "id": "satria", "tag": "SATRIA", "color": "#ffd400", "scene": "car",
            "name": "Proton Satria 1.3",
            "chassis": "", "year": "2003",
            "status": "Sold",
            "sold": True,
            "hp": 75, "torque_nm": 108, "weight_kg": 960,
            "power": "75 hp",
            "torque": "108 Nm @ 3,000 rpm",
            "review": {
                "title": "1 year with the Satria",
                "body": [
                    "The car behind the learning curve: practice runs before and after the licence test (taken in an "
                    "Axia), then a solid year borrowing it and looking after it like my own. Stock suspension had it rolling "
                    "through corners like a boat, but rowing through that manual gearbox never got old. It has since "
                    "moved on within the family."
                ],
            },
            "log": [],
        },
        {
            "id": "cbr250rr",
            "tag": "CBR250RR",
            "short": "CBR",
            "color": "#3d7bff",
            "scene": "bike",
            "name": "Honda CBR250RR",
            "chassis": "", "year": "2021",
            "status": "Sold",
            "sold": True,
            "hp": 40, "torque_nm": 25, "weight_kg": 168,
            "power": "40 hp @ 13,000 rpm",
            "torque": "25 Nm @ 11,000 rpm",
            "review": {
                "title": "<1 year / 10,000 km review",
                "body": [
                    "Wrote this review after selling the bike, but this bike was fantastic. For a beginner who started on a 150cc (RS150), the CBR250RR really gave me that good startle when yanking that throttle.",
                    "For beginners, the twin cylinder's 40 hp and 25 Nm packed enough punch for roads like Bukit Tinggi and Genting, as it has enough power throughout the power band. Unfortunately, like everyone else, I became power hungry after only 3 months of owning it.",
                    "Fuel efficiency was excellent for an \"RR\" track factory-tuned sports bike. I also managed to daily it for more than a month, and I can safely say it is daily-driver friendly, considering other factors like its posture and its lightweight nature as well.",
                    "Suspension was incredible when I paired the CBR with a pair of Rosso IIIs. It was really easy to flick thru the corners with confidence. Only downside was that the tyres (especially the rear) get worn too fast when you ride it frequently. Swapped to S22s after that, and I have to be honest, I was not a big fan of the riding experience as the S22s are stiffer than the Rossos. The S22s' handling was still on par (if not better) with the Rossos, as they grip like hell when the tyres are warm.",
                    "In conclusion, the CBR250RR is a superb starter bike and is one of the best bikes (maybe even the perfect bike) I've ridden for small twisties like BTIC."
                ]
            },
            "log": []
        },
    ],
}

# ---- TRACK DAY (inside the Garage, behind the same password) ---------------
# Seeded into garage.json once (also merged into an existing garage.json).
# After that, sessions are added on the site. To add a track, add it here AND
# to garage.json (or delete "trackday" from garage.json to re-seed).
#   status: "active" (you ride it) | "planned" (not ridden yet)
#   map:    "sepang" = built-in drawn layout; "" = trace pending (until a GPS
#           session is uploaded, which will provide the real line)
TRACKDAY = {
    "tracks": [
        {
            # RUD Karting Sepang International Track (inside the Sepang circuit complex)
            "id": "sgk", "name": "SGK", "alias": "RUD", "kind": "Go-kart circuit",
            "location": "Sepang, Selangor", "length_km": 1.13,
            "status": "active", "map": "sgk", "color": "#b6ff2e",  # lime
            "laptrophy": "Sepang Go Kart Circuit",  # the name in LapTrophy's track CSV
            "vehicle": "Kawasaki ZX-4RR",  # LapTrophy exports don't record the bike; used for uploaded sessions
            # GPS to map coordinates, fitted to the drawn layout from the Sep 15 session
            "map_fit": {"lat0": 2.763287, "lon0": 101.72829, "x": [2.0566, 0.0014, 490.7879], "y": [0.0224, -2.0712, 322.0924]},
        },
        {
            # 12 possible layouts; map = the one ridden, traced from satellite (~0.93 km)
            "id": "horizon", "name": "Beranang Horizon Circuit", "alias": "", "kind": "Kart circuit",
            "location": "Beranang, Selangor", "length_km": 0.93, "status": "active", "map": "horizon", "color": "#ff2a1a",  # red
            "note": "Ridden at an open track day - no timed lap yet",
        },
        {
            "id": "sepang", "name": "Sepang International Circuit", "alias": "SIC", "kind": "F1 circuit",
            "location": "Sepang, Selangor", "length_km": 5.543, "turns": 15,
            "status": "planned", "map": "sepang", "color": "#00a19c",  # Petronas Emerald
        },
    ],
    # each: {"track": id, "date": "YYYY-MM-DD", "vehicle": "...", "best": "m:ss.sss", "notes": "..."}
    # Sessions here with a "source" are imports (e.g. LapTrophy GPS logs): they're added to the
    # live server's garage.json on the next deploy. Sessions logged on the site live only there.
    "sessions": [
        {
            "track": "sgk", "date": "2026-09-15", "vehicle": "Kawasaki ZX-4RR", "best": "1:06.67",
            "notes": "8 laps, best on lap 8 - LapTrophy GPS log",
            "laps": [90.09, 70.69, 70.2, 70.47, 69.78, 68.89, 67.08, 66.67], "source": "laptrophy-2026-09-15-153423",
            # derived from the GPS log (1 Hz): sector gates at 1/3 and 2/3 of the lap, speed traces & best-lap line
            "telemetry": {"lap_length_m":1129,"laps":[90.09,70.69,70.2,70.47,69.78,68.89,67.08,66.67],"sectors":[[40.5,26.94,22.66],[26.85,21.13,22.71],[26.36,21.51,22.33],[26.65,21.43,22.39],[26.82,21.32,21.64],[26.22,21.7,20.97],[25.25,21.14,20.69],[24.79,21.39,20.5]],"best_lap":8,"compare_lap":2,"top_speed":102,"trace_best":[[0,101.7],[0,101.7],[21,99.6],[32,69.5],[50,69.5],[63,67.2],[84,56.1],[94,44.8],[102,34.8],[130,62.0],[143,57.5],[155,57.5],[170,44.8],[190,45.8],[202,48.6],[217,48.6],[237,70.0],[258,72.4],[285,92.7],[302,92.7],[314,70.9],[328,63.9],[339,32.6],[349,28.4],[360,30.9],[369,31.3],[379,27.6],[393,38.9],[409,52.1],[425,58.4],[442,60.5],[459,62.8],[473,64.5],[507,64.5],[527,74.1],[539,61.1],[549,61.1],[556,39.1],[576,39.1],[587,44.7],[613,70.6],[626,52.6],[640,56.0],[655,56.0],[670,52.2],[689,52.2],[721,52.2],[745,73.5],[761,73.5],[772,48.3],[784,48.3],[792,42.9],[828,42.9],[838,41.9],[853,51.1],[864,51.1],[877,46.7],[897,46.7],[937,47.8],[961,74.1],[978,74.1],[991,58.2],[1006,58.2],[1020,60.6],[1030,50.1],[1052,60.0],[1081,60.0],[1111,97.7],[1129,99.9]],"trace_compare":[[0,87.9],[2,87.9],[22,87.9],[37,77.7],[46,58.6],[61,58.6],[73,52.9],[75,37.3],[90,43.7],[125,72.3],[137,72.3],[147,56.2],[156,46.2],[167,44.5],[198,50.7],[212,53.1],[228,53.1],[248,67.5],[265,69.7],[281,67.4],[297,67.4],[309,66.1],[317,50.7],[330,46.2],[342,36.1],[360,36.1],[381,36.1],[388,30.8],[393,29.0],[434,78.1],[448,78.1],[463,65.1],[484,65.1],[498,65.6],[514,66.5],[543,84.9],[555,59.6],[564,48.0],[572,37.8],[581,36.4],[607,49.6],[621,49.6],[634,51.4],[649,51.4],[664,55.2],[684,62.9],[693,55.2],[705,54.8],[725,54.8],[745,69.0],[760,69.0],[773,64.9],[783,48.4],[795,48.4],[806,48.8],[826,48.8],[839,45.9],[850,45.0],[856,38.0],[894,73.8],[908,73.8],[919,60.1],[935,60.1],[951,54.9],[969,65.1],[981,57.4],[994,57.4],[1046,73.9],[1063,73.9],[1081,73.9],[1101,81.7],[1119,77.8],[1129,77.8]],"map_best":[[653.3,316.1,102],[653.1,316.7,102],[636.2,359.1,100],[626.9,381.4,69],[608.7,415.3,69],[586.5,434.4,67],[555.0,400.3,56],[554.4,378.6,45],[537.2,379.9,35],[563.4,324.7,62],[577.1,300.1,57],[575.0,274.6,57],[541.8,274.3,45],[517.1,310.3,46],[515.6,335.3,49],[516.2,368.3,49],[507.8,412.7,70],[499.6,458.0,72],[489.2,516.3,93],[483.1,550.9,93],[477.1,576.9,71],[447.1,567.6,64],[435.0,546.7,33],[434.0,524.7,28],[448.6,505.2,31],[450.9,487.4,31],[429.6,482.4,28],[400.9,492.7,39],[372.7,513.6,52],[338.2,519.8,58],[304.8,503.8,60],[281.0,472.9,63],[265.4,446.6,64],[286.2,376.4,64],[271.7,336.0,74],[265.8,308.7,61],[270.8,288.6,61],[284.4,279.9,39],[323.2,300.5,39],[345.8,306.0,45],[368.2,359.3,71],[394.0,353.4,53],[424.6,358.6,56],[454.9,347.8,56],[471.9,318.9,52],[464.9,277.2,52],[424.2,221.2,52],[428.2,168.7,74],[435.3,134.3,74],[459.4,130.5,48],[469.6,107.2,48],[483.7,94.9,43],[497.8,172.4,43],[514.2,186.0,42],[523.4,217.9,51],[544.3,229.3,51],[571.4,232.7,47],[601.5,200.1,47],[612.0,114.0,48],[634.0,65.6,74],[668.0,52.2,74],[694.2,65.5,58],[717.4,86.8,58],[727.3,117.2,61],[745.7,129.2,50],[731.5,173.5,60],[685.3,217.1,60],[669.3,282.2,98],[655.3,317.0,100]]},
        },
    ],
}
