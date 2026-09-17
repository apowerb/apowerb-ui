<p align="center">
  <img src="https://docs.apowerb.com/logo/apowerb-wide.png" alt="apowerb" height="80"/>
</p>

<p align="center">
  <strong>The official web interface for apowerb — build an agent, give it tools and knowledge, run it, and watch what it did.</strong>
</p>

<p align="center">
  <a href="https://docs.apowerb.com/">Documentation</a> •
  <a href="https://github.com/apowerb/apowerb-ui">GitHub</a> •
  <a href="https://thaink2.com">thaink2</a>
</p>

---

## What is this image?

The web interface for [**apowerb**](https://github.com/apowerb/apowerb), the open-source
agentic framework. It lets you build an agent, give it tools and knowledge, run it, and
inspect exactly what it did.

## Quick start

```bash
docker run -d --name apowerb-ui \
  -p 3000:3000 \
  -e API_URL=http://apowerb:8000 \
  apowerb/apowerb-ui:latest
```

The interface needs a running apowerb API. The
[deployment guide](https://docs.apowerb.com/deployment/dockercompose) brings up both
with Compose.

## Tags

| Tag | Content |
|-----|---------|
| `latest` | Latest published release |
| `x.y.z` | A specific release |

## License

Apache-2.0. Source and issues on [GitHub](https://github.com/apowerb/apowerb-ui).
