# SSH ControlMaster Setup for Persistent Connections

This guide explains how to set up SSH ControlMaster to maintain persistent SSH connections to your clusters, especially useful for clusters requiring VPN or manual authentication (password + Duo).

## What is ControlMaster?

SSH ControlMaster allows you to reuse a single SSH connection for multiple sessions. Once you authenticate once (VPN, password, Duo), subsequent connections will use the existing authenticated connection without requiring re-authentication.

## Benefits

- **Single authentication**: Authenticate once, reuse connection for hours
- **Faster connections**: Subsequent SSH commands connect instantly
- **Works with 2FA**: No need to complete Duo authentication repeatedly
- **VPN friendly**: Connect to VPN once, all operations work through that connection

## Setup Instructions

### 1. Create SSH Socket Directory

First, create a directory to store SSH connection sockets:

```bash
mkdir -p ~/.ssh/sockets
```

### 2. Configure SSH ControlMaster

Add the following to your `~/.ssh/config` file. Create the file if it doesn't exist:

```bash
# Global ControlMaster settings (applies to all hosts)
Host *
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h-%p
    ControlPersist 6h
```

**Or** configure it per-host (recommended for selective control):

```bash
# Example: VPN-required cluster
Host cluster.company.com
    User username
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h-%p
    ControlPersist 6h

# Example: Duo-required cluster
Host cluster.edu
    User username
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h-%p
    ControlPersist 6h
```

### 3. Configuration Explained

- **ControlMaster auto**: Automatically create master connection if none exists
- **ControlPath**: Where to store connection socket files
  - `%r` = remote username
  - `%h` = hostname
  - `%p` = port
- **ControlPersist 6h**: Keep connection alive for 6 hours after last use

## Usage Workflows

### For VPN-Required Clusters (e.g., GlobalProtect)

1. **Connect to VPN**:
   ```bash
   # Connect using your VPN client (e.g., GlobalProtect)
   # Authenticate with your credentials
   ```

2. **Establish master SSH connection**:
   ```bash
   ssh username@cluster.company.com
   # Enter password/complete 2FA if required
   # Keep this terminal open or exit - connection persists!
   ```

3. **Use the dashboard**: All operations (job submission, GPU checks, etc.) will now work seamlessly through the established connection

4. **Connection persists for 6 hours** from last use

### For Duo-Required Clusters (No VPN)

1. **Establish master SSH connection**:
   ```bash
   ssh username@cluster.edu
   # Enter your password when prompted
   # Complete Duo 2FA (push notification or code)
   # Keep terminal open or exit - connection persists!
   ```

2. **Use the dashboard**: All subsequent SSH operations will reuse this authenticated connection

3. **Connection persists for 6 hours** from last use

## Verifying ControlMaster is Working

### Check active connections:
```bash
ls -la ~/.ssh/sockets/
```

You should see socket files like: `username@cluster.edu-22`

### Check connection status:
```bash
ssh -O check username@cluster.edu
```

Output if working:
```
Master running (pid=12345)
```

### Manually close a connection:
```bash
ssh -O exit username@cluster.edu
```

## Troubleshooting

### Connection still asks for password/Duo

**Problem**: ControlMaster socket doesn't exist or expired

**Solution**:
1. Check if socket exists: `ls ~/.ssh/sockets/`
2. Manually establish connection: `ssh username@cluster.edu`
3. Try again after authentication

### "Control socket connect: No such file or directory"

**Problem**: Socket directory doesn't exist

**Solution**:
```bash
mkdir -p ~/.ssh/sockets
chmod 700 ~/.ssh/sockets
```

### VPN disconnects frequently

**Problem**: VPN timeout settings

**Solution**:
- Check VPN client settings for session timeout
- Some VPNs disconnect after inactivity
- Re-establish master connection after VPN reconnect

### Stale socket files

**Problem**: Socket exists but connection is dead

**Solution**:
```bash
# Remove stale sockets
rm ~/.ssh/sockets/*

# Or remove specific socket
rm ~/.ssh/sockets/username@cluster.edu-22
```

## Dashboard Integration

The MLOps Mission Control dashboard will:

1. **Show connection status** on the main dashboard for clusters requiring VPN/manual auth
2. **Provide test connection button** to verify if ControlMaster connection is active
3. **Display setup instructions** if connection fails
4. **Gracefully handle** disconnections with helpful error messages

### Testing Connection from Dashboard

1. Navigate to the dashboard
2. Look for "Cluster Connections" section
3. Click "Test Connection" for your cluster
4. If failed, click "Setup Guide" for instructions
5. Follow the guide to establish connection
6. Test again - should show "Connected"

## Security Notes

- Socket files are stored in `~/.ssh/sockets/` with restricted permissions
- Only your user can access these socket files
- Connections automatically expire after 6 hours
- VPN disconnection doesn't immediately close SSH connection (socket remains until timeout)
- Always use VPN when required by your institution's security policy

## Advanced Configuration

### Different timeout per cluster:
```bash
Host important-cluster.edu
    ControlPersist 12h

Host temporary-cluster.com
    ControlPersist 1h
```

### Disable ControlMaster for specific host:
```bash
Host no-multiplex.edu
    ControlMaster no
```

### Share connections only for specific operations:
```bash
Host cluster.edu
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h-%p
    ControlPersist 6h
    # Only use existing connections, don't create new ones
    # ControlMaster no
    # ControlMaster autoask  # Ask before creating
```

## References

- [OpenSSH ControlMaster Documentation](https://en.wikibooks.org/wiki/OpenSSH/Cookbook/Multiplexing)
- SSH man page: `man ssh_config`
- Your institution's SSH/VPN documentation
