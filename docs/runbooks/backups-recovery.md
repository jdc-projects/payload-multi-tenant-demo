# Local backups and recovery

## Data ownership

The development Compose project (normally `payload-multi-tenant-demo`) has two
named volumes:

| Data       | Volume          | Contents                                                 |
| ---------- | --------------- | -------------------------------------------------------- |
| PostgreSQL | `postgres-data` | Users, tenants, pages, drafts, revisions, and metadata   |
| RustFS     | `rustfs-data`   | Objects in the `payload-media` bucket, including uploads |

Both survive `Ctrl-C` and normal `docker compose down`. Managed test projects
(`payload-demo-*`) are disposable and cleaned up by the test stack. Images,
containers, `.next-*` directories, and generated import maps are disposable.
A database dump alone is incomplete because media lives in RustFS.

Run these commands from the repository root. Tools run inside containers, so a
non-default `POSTGRES_PORT` does not need to be substituted. Set `PROJECT` only
when intentionally operating on a named project.

```sh
set -eu
# Compose reads .env for interpolation, while the commands below also need the
# values exported into pg_dump/pg_restore and the volume names.
set -a
. ./.env
set +a
PROJECT="${TEST_COMPOSE_PROJECT:-payload-multi-tenant-demo}"
COMPOSE="docker compose -p ${PROJECT} -f infra/docker-compose.yml"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="backups/${STAMP}"
mkdir -p "${DEST}"
```

## Create and verify a backup

Quiesce the CMS (stop host applications or use a maintenance window). Keep
Postgres running for its consistent dump, then archive RustFS while stopped:

```sh
rustfs_stopped=0
restart_rustfs() {
  status=$?
  if [ "${rustfs_stopped}" -eq 1 ]; then
    ${COMPOSE} start rustfs >/dev/null || true
  fi
  exit "${status}"
}
trap restart_rustfs EXIT

${COMPOSE} exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-payload}" -d "${POSTGRES_DB:-payload}" \
  --format=custom --file=/tmp/payload.dump
${COMPOSE} cp postgres:/tmp/payload.dump "${DEST}/payload.dump"
${COMPOSE} exec -T postgres rm -f /tmp/payload.dump

${COMPOSE} stop rustfs
rustfs_stopped=1
docker run --rm -v "${PROJECT}_rustfs-data:/data:ro" \
  -v "$(pwd)/${DEST}:/backup" alpine:3.20 \
  tar -czf /backup/rustfs-data.tar.gz -C /data .
${COMPOSE} start rustfs
rustfs_stopped=0
trap - EXIT
shasum -a 256 "${DEST}"/* > "${DEST}/SHA256SUMS"

shasum -a 256 -c "${DEST}/SHA256SUMS"
${COMPOSE} run --rm --no-deps -T \
  -v "$(pwd)/${DEST}:/backup:ro" postgres \
  pg_restore --list /backup/payload.dump >/dev/null
tar -tzf "${DEST}/rustfs-data.tar.gz" > /dev/null
```

The archive listing is read to completion by the PostgreSQL container; the
command fails if `pg_restore` cannot read the custom-format dump. The container
uses the Compose PostgreSQL image and environment, so custom `POSTGRES_DB` and
`POSTGRES_USER` values remain in effect without requiring host `pg_restore`.

`PROJECT` must exactly match the Compose project (`docker compose ls`); the
default development project is the repository directory name. Store the
backup and `.env`/secret-manager values separately.

## Restore and recovery rehearsal

Restore is destructive. Verify `PROJECT` and `DEST`, stop CMS/web processes,
and preserve failed volumes first if investigation is needed:

```sh
set -eu
set -a
. ./.env
set +a
PROJECT="${TEST_COMPOSE_PROJECT:-payload-multi-tenant-demo}"
COMPOSE="docker compose -p ${PROJECT} -f infra/docker-compose.yml"
: "${DEST:?set DEST to the backup directory before continuing}"

${COMPOSE} down
docker volume rm "${PROJECT}_postgres-data" "${PROJECT}_rustfs-data"
${COMPOSE} up -d --wait postgres rustfs
${COMPOSE} cp "${DEST}/payload.dump" postgres:/tmp/payload.dump
${COMPOSE} exec -T postgres pg_restore -U "${POSTGRES_USER:-payload}" \
  -d "${POSTGRES_DB:-payload}" --clean --if-exists /tmp/payload.dump
${COMPOSE} exec -T postgres rm -f /tmp/payload.dump

rustfs_stopped=0
restart_rustfs() {
  status=$?
  if [ "${rustfs_stopped}" -eq 1 ]; then
    ${COMPOSE} start rustfs >/dev/null || true
  fi
  exit "${status}"
}
trap restart_rustfs EXIT
${COMPOSE} stop rustfs
rustfs_stopped=1
docker run --rm -v "${PROJECT}_rustfs-data:/data" \
  -v "$(pwd)/${DEST}:/backup:ro" alpine:3.20 \
  sh -c 'rm -rf /data/* /data/.[!.]* /data/..?*; tar -xzf /backup/rustfs-data.tar.gz -C /data'
${COMPOSE} start rustfs
rustfs_stopped=0
trap - EXIT
```

Wait for services to become healthy, start the CMS, and verify admin login,
`demo1`, `demo2`, and `demo3`, plus a known media object. A rehearsal should
restore into a disposable project and record this checklist; checksums alone
do not prove application usability. Do not run `npm run seed` during recovery
unless recreating demo fixtures is intentional.

## Credential rotation and boundaries

- **Admin password:** `PAYLOAD_ADMIN_PASSWORD` only bootstraps the first user.
  Change an existing user's password in Payload admin (or its authenticated
  users API); changing `.env` does not rotate it.
- **Payload secret:** rotating `PAYLOAD_SECRET` is a planned session
  invalidation event. Restart the CMS and verify login afterward.
- **PostgreSQL:** set `POSTGRES_DB`, `POSTGRES_USER`, and
  `POSTGRES_PASSWORD` in the environment for new volumes. For an existing
  volume, change the role with `ALTER ROLE` and update the CMS environment;
  Compose environment values do not rewrite initialized volumes.
- **RustFS/S3:** rotate `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` together,
  recreate RustFS, then restart CMS. Compose consumes these values; changing
  only CMS values breaks media access.

Backups cannot recover lost secrets, an administrator's password, or data not
included in a completed backup.
