/**
 * BOT DE HIERARQUIA AUTOMATIZADA - FACÇÃO REALValverd
 * Sem banner na mensagem, com verificação de cargos em tempo real.
 */

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

// Carregar configuração de cargos
const configPath = path.join(__dirname, 'config.json');
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Inicializar cliente com Server Members Intent
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Obrigatório: Ativar Server Members Intent no Developer Portal!
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
 * Monta o painel limpo (sem banner)
 */
async function buildHierarchyEmbed(guild) {
  await guild.members.fetch();

  const embed = new EmbedBuilder()
    .setColor(config.embedColor || '#D4AF37')
    .setTitle('👑 HIERARQUIA OFICIAL • ' + config.factionName)
    .setDescription(
      '**PAINEL DE CARGOS & MEMBROS**\n' +
      'Sincronizado automaticamente pelo bot.\n' +
      'Qualquer alteração de cargo no Discord é atualizada instantaneamente.\n\n' +
      '──────────────────────────────────────'
    )
    .setTimestamp()
    .setFooter({ 
      text: `${config.factionName} System • Atualização Automática`, 
      iconURL: guild.iconURL({ dynamic: true }) || undefined 
    });

  let totalFactionMembers = 0;
  const countedMemberIds = new Set();

  for (const roleDef of config.roles) {
    // Busca o cargo pelo nome exato (ou ID caso configurado)
    const discordRole = guild.roles.cache.find(
      (r) => r.id === roleDef.discordRoleId || r.name.toLowerCase().trim() === roleDef.name.toLowerCase().trim()
    );

    let membersInRole = [];
    if (discordRole) {
      membersInRole = Array.from(discordRole.members.values());
    }

    membersInRole.forEach((m) => countedMemberIds.add(m.id));

    const roleTitle = `${roleDef.badgeEmoji} [${roleDef.name.toUpperCase()}] • (${membersInRole.length})`;
    
    let membersListString = '';
    if (membersInRole.length === 0) {
      membersListString = '*Nenhum membro ativo neste cargo.*';
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
  }

  totalFactionMembers = countedMemberIds.size;

  embed.addFields({
    name: '📊 ESTATÍSTICAS DA FACÇÃO',
    value: `👥 **Total de Membros:** ${totalFactionMembers}\n🛡️ **Cargos Cadastrados:** ${config.roles.length}\n⚡ **Status do Bot:** Online & Monitorando`,
    inline: false,
  });

  return embed;
}

/**
 * Envia ou edita a mensagem no canal especificado
 */
async function updateHierarchyPanel(reason = 'Rotina') {
  if (isUpdating) return;
  isUpdating = true;

  try {
    const guildId = process.env.GUILD_ID || config.guildId;
    const channelId = process.env.CHANNEL_ID || config.channelId;

    if (!guildId || !channelId) {
      console.warn('[AVISO] Configure GUILD_ID e CHANNEL_ID no .env ou config.json.');
      isUpdating = false;
      return;
    }

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      console.error(`[ERRO] Servidor ${guildId} não encontrado.`);
      isUpdating = false;
      return;
    }

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      console.error(`[ERRO] Canal ${channelId} não encontrado.`);
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

    // Se já existe mensagem anterior enviada pelo bot, apenas edita ela
    if (hierarchyMessageId) {
      try {
        const existingMessage = await channel.messages.fetch(hierarchyMessageId).catch(() => null);
        if (existingMessage) {
          await existingMessage.edit({ embeds: [embed], components: [refreshButton] });
          console.log(`[AUTO-SYNC] Painel atualizado! Motivo: ${reason}`);
          isUpdating = false;
          return;
        }
      } catch (err) {
        console.log('[INFO] Mensagem anterior não encontrada, enviando uma nova...');
      }
    }

    // Envia nova mensagem caso não exista
    const newMessage = await channel.send({ embeds: [embed], components: [refreshButton] });
    saveMessageId(newMessage.id);
    console.log(`[AUTO-SYNC] Novo painel criado com sucesso! ID: ${newMessage.id}`);
  } catch (error) {
    console.error('[ERRO] Falha ao atualizar painel:', error);
  } finally {
    isUpdating = false;
  }
}

// -------------------------------------------------------------
// EVENTOS DO DISCORD
// -------------------------------------------------------------

client.once('ready', async () => {
  console.log('=====================================================');
  console.log(`🤖 Bot REALValverd conectado como: ${client.user.tag}`);
  console.log('⚡ Verificação automática de cargos: ATIVA');
  console.log('=====================================================');

  await updateHierarchyPanel('Inicialização do Bot');

  // Intervalo de checagem de segurança a cada 30 segundos
  setInterval(() => {
    updateHierarchyPanel('Checagem Periódica');
  }, (config.updateIntervalSeconds || 30) * 1000);
});

/**
 * DETECTA ADIÇÃO OU REMOÇÃO DE CARGOS EM TEMPO REAL
 */
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  const addedRoles = newRoles.filter((role) => !oldRoles.has(role.id));
  const removedRoles = oldRoles.filter((role) => !newRoles.has(role.id));

  if (addedRoles.size > 0 || removedRoles.size > 0) {
    const factionRoleNames = config.roles.map((r) => r.name.toLowerCase().trim());
    
    const isRelevantRole = [...addedRoles.values(), ...removedRoles.values()].some((r) =>
      factionRoleNames.includes(r.name.toLowerCase().trim()) ||
      config.roles.some((cfg) => cfg.discordRoleId === r.id)
    );

    if (isRelevantRole) {
      console.log(`[AUTO-VERIFICAÇÃO] Alteração de cargo em @${newMember.user.tag}`);
      await updateHierarchyPanel(`Cargo alterado em @${newMember.user.tag}`);
    }
  }
});

client.on('guildMemberRemove', async (member) => {
  console.log(`[AUTO-VERIFICAÇÃO] Membro saiu do Discord: ${member.user.tag}`);
  await updateHierarchyPanel(`Membro saiu: ${member.user.tag}`);
});

client.on('guildMemberAdd', async (member) => {
  console.log(`[AUTO-VERIFICAÇÃO] Novo membro entrou: ${member.user.tag}`);
  await updateHierarchyPanel(`Novo membro: ${member.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton() && interaction.customId === 'btn_refresh_panel') {
    await interaction.deferUpdate();
    await updateHierarchyPanel(`Atualização manual solicitada por @${interaction.user.tag}`);
  }
});

client.login(process.env.DISCORD_TOKEN);
