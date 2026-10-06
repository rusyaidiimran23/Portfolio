"""Static portfolio content + the private garage log.

Edit these dicts to update your site. The public content is served at
/api/content; the garage data is served at /api/garage only with a valid token.
"""

# ---- PUBLIC CONTENT (homepage) --------------------------------------------

CONTENT = {
    "hero": {
        "name": "Rusyaidi Yeng",
        "tagline": "I build IoT systems end to end — from sensors and dataloggers in the "
                   "field to the platforms, dashboards and AI behind them.",
        "rpm": 15000,  # ZX-4RR redline vibe, drives the tachometer accent
    },
    # DRAFTED from your project docs — review wording, roles and client names
    # before publishing (some clients may not want to be named publicly).
    "about": (
        "I build environmental-monitoring systems end to end — out in the field "
        "with tripods, dataloggers and sensors, and back at the desk with the "
        "APIs, dashboards and alerts that turn readings into decisions. Weather, "
        "air quality, soil, AI cameras: if it measures something, I've "
        "probably wired it, coded it, or both. Off the clock it's a Nissan Cefiro "
        "and a Kawasaki ZX-4RR."
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
            "chassis": "A31",
            "review": {"body": ["To be added."]},
            "status": "In progress",
            "power": "—",
            "log": [
                {"date": "2026-06-02", "note": "Baseline compression test — all cylinders healthy."},
                {"date": "2026-06-20", "note": "New coilovers on order. Planning a fresh set of wheels."},
                {"date": "2026-07-10", "note": "Sourcing an intercooler for the RB swap."},
            ],
        },
        {
            "id": "zx4rr", "tag": "ZX-4RR", "color": "#7cff2e", "scene": "bike",
            "name": "Kawasaki ZX-4RR",
            "chassis": "2024",
            "status": "Running",
            "power": "77 hp @ 14,500 rpm",
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
            "id": "cbr250rr",
            "tag": "CBR250RR",
            "short": "CBR",
            "color": "#3d7bff",
            "scene": "bike",
            "name": "Honda CBR250RR",
            "chassis": "2021",
            "status": "Sold",
            "sold": True,
            "power": "40 hp / 25 Nm",
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
            "id": "sgk", "name": "SGK", "alias": "RUD", "kind": "Go-kart circuit",
            "location": "", "status": "active", "map": "", "color": "#ff2bd6",
        },
        {
            "id": "horizon", "name": "Horizon Go-Kart", "alias": "", "kind": "Go-kart circuit",
            "location": "Beranang, Selangor", "status": "active", "map": "", "color": "#00d2be",
        },
        {
            "id": "sepang", "name": "Sepang International Circuit", "alias": "SIC", "kind": "F1 circuit",
            "location": "Sepang, Selangor", "length_km": 5.543, "turns": 15,
            "status": "planned", "map": "sepang", "color": "#ffb000",
        },
    ],
    # each: {"track": id, "date": "YYYY-MM-DD", "vehicle": "...", "best": "m:ss.sss", "notes": "..."}
    "sessions": [],
}
