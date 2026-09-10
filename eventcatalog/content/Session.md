A session has one tenant, region, cluster, game build and current owner epoch. Core owns its canonical revision/lifecycle; Media Engine owns simulation only during a valid lease. roomId links the durable lobby; identity of a session is never reused by rematch.

Session states, transition preconditions and crash/drain behavior are specified in the domain and Media Engine pages. expires/endsBy is fixed at allocation from GameProfile.maxSessionSeconds. Startup time consumes that budget. The runtime must not extend it through late join, reconnect, drain or recovery.

Terminal status and unique settlement survive log/checkpoint cleanup. A client cannot obtain authority by presenting a stale Session object; use GetSession, current membership and short-lived admission.
