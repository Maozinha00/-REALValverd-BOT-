require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Inicialização com os intents necessários
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Certifique-se de que "Server Members Intent" está ativo no Discord Developer Portal!
    GatewayIntentBits.GuildMessages,
  ],
});

let hierarchyMessageId = process.env.MESSAGE_ID || config.messageId || null;
let isUpdating = false;

function saveMessageId(msgId) {
  hierarchyMessageId = msgId;
  config.messageId = msgId;
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Erro ao salvar config.json:', err);
  }
}

/**
 * Monta o painel oficial da REALValverd com o layout solicitado
 */
async function buildHierarchyEmbed(guild) {
  await guild.members.fetch();

  const embed = new EmbedBuilder()
    .setColor(config.embedColor || '#22C55E')
    .setTitle('👑 REALVALVERD • PAINEL DE HIERARQUIA ⚔️')
    .setDescription(
      '```ansi\n' +
      '\x1b[1;32m╔══════════════════════════════════════╗\n' +
      '          👑 REALVALVERD 👑\n' +
      '       ⚔️ PAINEL DE HIERARQUIA ⚔️\n' +
      '╚══════════════════════════════════════╝\x1b[0m\n\n' +
      '       🔥 DISCIPLINA • UNIÃO • RESPEITO 🔥\n' +
      '             💚 PODER • LEALDADE 💚\n' +
      '```\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .setTimestamp()
    .setFooter({ 
      text: '💚 REALVALVERD 💚 • ⚔️ MAIS QUE UMA FACÇÃO, UMA FAMÍLIA ⚔️', 
      iconURL: guild.iconURL({ dynamic: true }) || undefined 
    });

  let totalFactionMembers = 0;
  const countedMemberIds = new Set();

  // MAPEAMENTO COMPLETO DE TODOS OS CARGOS (Incluindo as 5 gerências)
  const roleTitleMap = {
    '00': '👑  00  ┃ LIDERANÇA SUPREMA',
    '01': '⭐  01  ┃ SUB-LÍDER / BRAÇO DIREITO',
    '02': '🛡️  02  ┃ CONSELHO',
    '03': '🎖️  03  ┃ AUDITORIA / GERÊNCIA EXECUTIVA',
    'gerente geral': '💼  ┃ GERENTE GERAL',
    'gerente de farm': '🌾  ┃ GERENTE DE FARM',
    'gerente de vendas': '💰  ┃ GERENTE DE VENDAS',
    'gerente de ação': '⚔️  ┃ GERENTE DE AÇÃO',
    'gerente de acao': '⚔️  ┃ GERENTE DE AÇÃO',
    'gerente de rec': '📋  ┃ GERENTE DE REC',
    'gerente de recrutamento': '📋  ┃ GERENTE DE REC',
    'elite': '⚜️  ┃ ELITE',
    'supervisor': '👁️  ┃ SUPERVISOR',
    'membro': '🥋  ┃ MEMBRO',
    'morador': '🏠  ┃ MORADOR',
    'entroza': '🌱  ┃ ENTROZA',
  };

  for (let i = 0; i < config.roles.length; i++) {
    const roleDef = config.roles[i];
    const roleKey = roleDef.name.toLowerCase().trim();

    // Busca cargo pelo ID numérico (se houver) ou pelo nome exato no servidor
    const discordRole = guild.roles.cache.find(
      (r) => (roleDef.discordRoleId && r.id === roleDef.discordRoleId) || r.name.toLowerCase().trim() === roleKey
    );

    let membersInRole = [];
    if (discordRole) {
      membersInRole = Array.from(discordRole.members.values());
    }

    membersInRole.forEach((m) => countedMemberIds.add(m.id));

    const formattedTitle = roleTitleMap[roleKey] || `${roleDef.badgeEmoji}  ${roleDef.name.toUpperCase()}`;
    const roleTitle = `${formattedTitle}  (${membersInRole.length})`;

    let membersListString = '';
    if (membersInRole.length === 0) {
      membersListString = '> *Nenhum membro vinculado.*';
    } else {
      membersListString = membersInRole
        .map((m) => {
          const name = m.displayName || m.user.username;
          return `> • <@${m.id}> (${name})`;
        })
        .join('\n');
    }

    embed.addFields({
      name: roleTitle,
      value: membersListString,
      inline: false,
    });

    // Separador entre cúpula e gerência
    if (roleKey === '03') {
      embed.addFields({
        name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        value: '\u200b',
        inline: false,
      });
    }
  }

  totalFactionMembers = countedMemberIds.size;

  embed.addFields(
    {
      name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      value: '\u200b',
      inline: false,
    },
    {
      name: '📊  CENTRAL DA FACÇÃO',
      value: 
        `👥 **Total de membros:** ${totalFactionMembers}\n` +
        `🛡️ **Cargos cadastrados:** ${config.roles.length}\n` +
        '🤖 **Sistema:** ONLINE\n' +
        '🔄 **Sincronização automática de cargos:** ATIVADA',
      inline: false,
    },
    {
      name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      value: '```yaml\n💚 REALVALVERD 💚\n⚔️ MAIS QUE UMA FACÇÃO, UMA FAMÍLIA ⚔️\n```',
      inline: false,
    }
  );

  return embed;
}

/**
 * Atualiza ou envia o painel
 */
async function updateHierarchyPanel(reason = 'Rotina') {
  if (isUpdating) return;
  isUpdating = true;

  try {
    const guildId = process.env.GUILD_ID || config.guildId;
    const channelId = process.env.CHANNEL_ID || config.channelId;

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      console.error(`[ERRO] Servidor ${guildId} não encontrado.`);
      isUpdating = false;
      return;
    }

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      console.error(`[ERRO] Canal ${channelId} não encontrado ou sem permissão de texto.`);
      isUpdating = false;
      return;
    }

    const embed = await buildHierarchyEmbed(guild);

    const refreshButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_refresh_panel')
        .setLabel('🔄 Atualizar Painel')
        .setStyle(ButtonStyle.Secondary)
    );

    // Se a mensagem já existe, apenas edita (sem poluir o chat)
    if (hierarchyMessageId) {
      try {
        const existingMessage = await channel.messages.fetch(hierarchyMessageId).catch(() => null);
        if (existingMessage) {
          await existingMessage.edit({ embeds: [embed], components: [refreshButton] });
          console.log(`[AUTO-SYNC] Painel atualizado com sucesso! Motivo: ${reason}`);
          isUpdating = false;
          return;
        }
      } catch (err) {
        console.log('[INFO] Mensagem anterior não encontrada, enviando uma nova...');
      }
    }

    // Se não existir mensagem prévia, envia uma nova
    const newMessage = await channel.send({ embeds: [embed], components: [refreshButton] });
    saveMessageId(newMessage.id);
    console.log(`[AUTO-SYNC] Novo painel publicado no canal! ID: ${newMessage.id}`);
  } catch (error) {
    console.error('[ERRO] Falha ao atualizar painel:', error);
  } finally {
    isUpdating = false;
  }
}

// -------------------------------------------------------------
// EVENTOS DO BOT
// -------------------------------------------------------------

client.once('ready', async () => {
  console.log('=====================================================');
  console.log(`🤖 Bot REALValverd conectado como: ${client.user.tag}`);
  console.log('⚡ Monitoramento automático de cargos ATIVADO');
  console.log('=====================================================');

  await updateHierarchyPanel('Inicialização do Bot');

  setInterval(() => {
    updateHierarchyPanel('Checagem Periódica de Segurança');
  }, (config.updateIntervalSeconds || 30) * 1000);
});

// Detecta adições ou remoções de cargos no servidor em tempo real
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  const added = newRoles.filter((r) => !oldRoles.has(r.id));
  const removed = oldRoles.filter((r) => !newRoles.has(r.id));

  if (added.size > 0 || removed.size > 0) {
    const roleNames = config.roles.map((r) => r.name.toLowerCase().trim());
    const isRelevant = [...added.values(), ...removed.values()].some((r) =>
      roleNames.includes(r.name.toLowerCase().trim()) ||
      config.roles.some((cfg) => cfg.discordRoleId === r.id)
    );

    if (isRelevant) {
      console.log(`[AUTO-VERIFICAÇÃO] Cargo alterado em @${newMember.user.tag}. Atualizando painel...`);
      await updateHierarchyPanel(`Cargo alterado em @${newMember.user.tag}`);
    }
  }
});

client.on('guildMemberRemove', async (member) => {
  console.log(`[AUTO-VERIFICAÇÃO] Membro saiu do servidor: ${member.user.tag}`);
  await updateHierarchyPanel(`Membro saiu: ${member.user.tag}`);
});

client.on('guildMemberAdd', async (member) => {
  console.log(`[AUTO-VERIFICAÇÃO] Novo membro entrou: ${member.user.tag}`);
  await updateHierarchyPanel(`Novo membro: ${member.user.tag}`);
});

// Responde ao clique do botão no Discord
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton() && interaction.customId === 'btn_refresh_panel') {
    await interaction.deferUpdate();
    await updateHierarchyPanel(`Clique no botão por @${interaction.user.tag}`);
  }
});

client.login(process.env.DISCORD_TOKEN);
