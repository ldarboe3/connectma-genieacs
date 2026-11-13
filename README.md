# ConnectMa GenieACS deployment starter

This repository deploys GenieACS 1.2.16 to Render in the Oregon region.

## Services created

- `connectma-genieacs-cwmp`: public HTTPS endpoint for TR-069/CWMP devices.
- `connectma-genieacs-fs`: public HTTPS endpoint for device file downloads.
- `connectma-genieacs-nbi`: private GenieACS NBI service.
- `connectma-genieacs-nbi-gateway`: public HTTPS gateway requiring HTTP Basic authentication before forwarding to private NBI.

The NBI itself is not exposed publicly. GenieACS NBI does not provide built-in authentication; do not create a public NBI service without an authentication layer.

## Before deploying

1. Create a MongoDB Atlas cluster in an Oregon region if available (AWS us-west-2 is a suitable regional match).
2. Create a database user dedicated to GenieACS.
3. Copy the Atlas connection string and append `/genieacs` as the database name, preserving any required query parameters. URL-encode special characters in the username/password.
4. In Atlas Network Access, allow the outbound IP ranges used by your Render services in Oregon. Find these in each Render service's **Connect > Outbound** panel after creation. Do not use `0.0.0.0/0` for production.
5. Keep Atlas credentials out of Git and out of Replit source code.

For development, an Atlas free/shared cluster can be used if it meets its limits. Before production with 100–500 devices, review Atlas capacity, backups, storage, and monitoring and upgrade as needed.

## Deploy with Render Blueprint

1. Push this repository to a new GitHub repository named `connectma-genieacs`.
2. In Render, choose **New > Blueprint** and connect that repository.
3. Review the four services. They are all pinned to Oregon.
4. Select paid, always-on service plans. The Blueprint uses the Starter plan as a low-cost pilot baseline (512 MB RAM per service); monitor memory and CPU and scale up before production if needed.
5. Render will prompt for `GENIEACS_MONGODB_CONNECTION_URL` for the CWMP, FS, and NBI services. Supply the same Atlas URI each time.
6. Render will prompt for `GENIEACS_NBI_USERNAME` and `GENIEACS_NBI_PASSWORD` for the gateway. Use a unique long random username/password pair and store them in a password manager.
7. Deploy the Blueprint.

## After deployment

Copy the actual public URLs from the Render dashboard; Render may alter a service slug if a name is unavailable.

Expected endpoints:

- CWMP: `https://<actual-cwmp-service-host>/`
- File Server: `https://<actual-fs-service-host>/`
- NBI gateway: `https://<actual-nbi-gateway-host>/`

The private NBI service should have no public URL. The gateway's `/healthz` endpoint is a health check only; it does not verify database connectivity or NBI functionality.

## Configure Replit secrets

In Replit, add these as Secrets:

- `GENIEACS_NBI_URL` = actual HTTPS URL of the NBI gateway
- `GENIEACS_NBI_USERNAME` = same username entered for the Render gateway
- `GENIEACS_NBI_PASSWORD` = same password entered for the Render gateway

Add non-secret configuration values:

- `GENIEACS_CWMP_URL` = actual HTTPS CWMP URL
- `GENIEACS_FS_URL` = actual HTTPS File Server URL
- `ROUTER_MANAGEMENT_PRIVATE_NETWORK_READY` = `false`

Do not put these credentials in browser/frontend code. Only the ConnectMa backend should call the NBI gateway.

## Verify before connecting real routers

1. Confirm all four Render services are healthy.
2. Confirm the gateway `/healthz` returns `{"status":"ok"}`.
3. Confirm the gateway rejects an unauthenticated request with HTTP 401.
4. Confirm an authenticated request can reach NBI (for example, a read-only devices query) and returns a valid GenieACS response.
5. Check Render logs for MongoDB connection errors.
6. Test one compatible TR-069 device in a controlled pilot before changing any POP-wide configuration.

Do not set `ROUTER_MANAGEMENT_PRIVATE_NETWORK_READY=true` until the secure path and authenticated API have been verified. This flag should only be changed if the ConnectMa application uses it for a verified network-readiness gate; it does not itself create a VPN or secure network.

## Important compatibility and deployment notes

- This deploys the GenieACS services needed for the ConnectMa backend integration. It does not deploy the optional GenieACS web UI.
- GenieACS manages only devices that support TR-069/CWMP with compatible firmware and configuration.
- MikroTik, Ubiquiti, Huawei, and TP-Link support is model/firmware-specific. Keep RouterOS API, SNMP, ICMP, and vendor-specific integrations for devices that do not support TR-069.
- Render terminates TLS for public web services. The GenieACS processes listen on the internal Render service ports.
- The Starter plan is a pilot baseline, not a capacity guarantee for 100–500 active devices. Monitor actual session volume, MongoDB operations, CPU, memory, and request latency.
- Render's private network is scoped to services in the same region/workspace. The Replit development app accesses NBI through the authenticated HTTPS gateway, not the private hostname.
- The gateway is a minimal Basic-auth bridge. For production, add rate limiting, credential rotation, request logging without secrets, and consider a dedicated API-key/JWT or mTLS gateway. Never log Authorization headers.
