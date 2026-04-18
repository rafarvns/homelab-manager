# 📂 Homelab Node: Legacy NAS (150)
**Documentação de Infraestrutura e Serviços**

Documento de integração arquitetural projetado para o **Painel Multi-Homelab (Custom Dashboard)**. Contém descritivos de serviços, endereçamentos, credenciais de acesso, limitações físicas e postura de segurança.

---

## ⚡ 1. Identificação do Instância (Node Info)

*   **Hostname/Identificador:** Homelab-NAS-Legacy
*   **Endereço IP Local:** `192.168.10.150`
*   **Sistema Operacional:** Ubuntu 16.04.7 LTS (Xenial Xerus)
*   **Usuário Root/Admin:** `rafarvns`
*   **Método de Acesso Terminal:** SSH via Ed25519 Key (`nas_new_key`)

---

## 🖧 2. Portas e Serviços Ativos (Service Mapping)

Lista de serviços ativos ideais para indexação via botões e iframes no futuro Dashboard Web:

| Serviço | Porta | Tipo | URL Local/Acesso | Descrição Funcional | Status do Serviço |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Portainer CE** | `9000` | Web UI | `http://192.168.10.150:9000` | Painel central do Docker. Substitui o terminal na verificação de health dos containers. | 🟢 Online (Docker) |
| **FileBrowser** | `8081` | Web UI | `http://192.168.10.150:8081` | Gerenciador de arquivos via navegador. Mapeia diretamente o disco principal. | 🟢 Online (Docker) |
| **AdGuard Home** | `3000` | Web UI | `http://192.168.10.150:3000` | Painel de controle inicialização do Servidor DNS local / Sinkhole. | 🔵 Setup Pending (Docker)|
| **Samba Server** | `445, 139`| TCP/SMB | `\\192.168.10.150\Data` | Compartilhamento em rede mapeável diretamente para Explorer nativo. | 🟢 Online (Native OS)|
| **SSH** | `22` | TCP | `ssh rafarvns@192.168.10.150` | Acesso de terminal para admin nível OS. | 🟢 Online (Native OS)|

---

## 🔒 3. Postura de Segurança e Rede (Networking)

*   **Firewall Ativo (UFW):** Sim.
*   **Regra "Air-Gapped Local":** Todo tráfego de origem NÃO-LOCAL é bloqueado (drop). O servidor apenas atende requisições providas da sub-rede local `192.168.10.0/24`. Acesso via Web Extena (Internet) está blindado no nível do Host.
*   **Serviço DNS Exposto:** AdGuard captura porta `53` TCP/UDP, preparada para interceptação de anúncios.

---

## 💾 4. Armazenamento e Diretórios Core (Storage)

Topologia de pastas críticas para scripts de automação.

*   **Storage Principal (Limitado):** Disco de `74.5 GB` rodando SO e dados juntos (/dev/sda5).
*   **Pasta Publica (Samba):** `/home/rafarvns/Data` `(Permissão: 0777 Livre)`
*   **Configs do AdGuard:** `/home/rafarvns/adguard/conf` & `/home/rafarvns/adguard/work`
*   **Chaves SSH (.ssh):** `/home/rafarvns/.ssh/authorized_keys`

---

## ⚠️ 5. Limitações de Arquitetura Fixas (Hardware Profiling)

**Crucial para o Dashboard:** Não tentar automatizar envios ou deploys de containers modernos neste Node sem consultar sua arquitetura de CPU.

*   **Capacidade de Processamento:** Pentium Dual-Core E5700 @ 3.00GHz
*   **Erro de Instruções (x86-64-v1):** Este nódulo possui CPU de legância que \*\*não possui\*\* suporte às flags de instruções `SSE4.x`, `AVX`, etc.
*   **Consequência no Docker:** Imagens muito novas (Baseadas em Alpine moderno, ou Ubuntu 23+) vão retornar falha catástrofica `Illegal instruction` ou `vsyscall error`. Deploys devem sempre utilizar imagens com suporte Linux retro-compatível.
*   **Transcodificação de Mìdia:** Bloqueada/Não-Recomendada. A CPU não consegue processar stream de vídeo 1080p robustos ou H.265.

---

*Gerado pela Antigravity AI em processo de Auditoria de Homelab.*
