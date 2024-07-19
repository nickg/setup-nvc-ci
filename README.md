# setup-nvc-ci

GitHub Action to install [NVC VHDL simulator](https://github.com/nickg/nvc).

## Usage

See [action.yml](action.yml)

<!-- start usage -->
```yaml
- uses: nickg/setup-nvc-ci@v1
  with:
    version: latest
- run: |
    nvc --version    # NVC binary added to path
```

Both Ubuntu and Windows runners are supported.  The MSYS2 shell on
Windows does not use the system `PATH` environment variable so you need
to add it manually:

```sh
export PATH=/c/Program\ Files/NVC/bin:$PATH
```
